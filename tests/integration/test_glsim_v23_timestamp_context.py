"""Local-only GLSim timestamp-context qualification for the frozen V2.3 source.

This test never contacts Studio-dev.  It starts an isolated GLSim process,
deploys the exact checked-in V2.3 source, and passes the documented
``sim_config.genvm_datetime`` transaction context through the real
``genlayer_py`` write path.  The test is evidence about local runtime
behavior only; it is not hosted Studio-dev qualification.
"""

from __future__ import annotations

import copy
import hashlib
import json
import os
import socket
import subprocess
import time
from pathlib import Path

import pytest
import requests
from eth_account import Account
from genlayer_py.chains.localnet import localnet
from genlayer_py.client import GenLayerClient

ROOT = Path(__file__).resolve().parents[2]
EXPECTED_SOURCE_SHA = "E22EF2CCF7BFD03C555A13ADD2FADD3C2891C33E34522AB178B7785F9E8571EE"
LOCAL_KEY = "0x" + "11" * 32
REFERENCE_SHA = "aa" * 32
LICENSE_SHA = "bb" * 32
BASE_TIME = "2026-01-01T00:00:00Z"
VALID_FROM = 1_767_225_600  # 2026-01-01T00:00:00Z
VALID_UNTIL = 1_767_312_000  # 2026-01-02T00:00:00Z


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return int(sock.getsockname()[1])


def _rpc(url: str, method: str, params):
    response = requests.post(
        url,
        json={"jsonrpc": "2.0", "id": 1, "method": method, "params": params},
        timeout=30,
    )
    response.raise_for_status()
    body = response.json()
    if "error" in body:
        raise RuntimeError(body["error"].get("message", str(body["error"])))
    return body["result"]


def _sim_config(datetime_value: str) -> dict:
    return {"genvm_datetime": datetime_value}


def _policy_args(policy_id: str, valid_from: int, valid_until: int, recipient: str) -> list:
    license_text = "Controlled local timestamp fixture."
    return [
        policy_id,
        REFERENCE_SHA,
        1,
        "image/png",
        "controlled://rightsrail/reference.png",
        LICENSE_SHA,
        len(license_text.encode()),
        license_text,
        ["commercial editorial"],
        ["gambling promotion"],
        ["newsletter"],
        ["betting advertisement"],
        ["cropping allowed"],
        "Visible attribution required",
        "Synthetic endorsement prohibited",
        valid_from,
        valid_until,
        10,
        recipient,
    ]


def _request_args(request_id: str, policy_id: str) -> list:
    return [
        request_id,
        policy_id,
        1,
        "commercial editorial",
        "newsletter",
        "controlled timestamp boundary",
        REFERENCE_SHA,
        1,
        "image/png",
        "",
        "RightsRail local fixture",
    ]


def _wait_transaction(client: GenLayerClient, transaction_id: str) -> dict:
    deadline = time.monotonic() + 30
    last = None
    while time.monotonic() < deadline:
        last = client.get_transaction(transaction_id)
        lifecycle = last.get("lifecycle", {})
        if lifecycle.get("state") in {"finalized", "canceled"}:
            return last
        time.sleep(0.1)
    raise AssertionError(f"local GLSim transaction did not finalize: {last}")


def _write(
    client: GenLayerClient,
    address: str,
    account,
    method: str,
    args: list,
    datetime_value: str,
    value: int = 0,
) -> tuple[str, dict]:
    transaction_id = client.write_contract(
        address,
        method,
        account=account,
        args=args,
        kwargs={},
        value=value,
        leader_only=False,
        sim_config=_sim_config(datetime_value),
    )
    return transaction_id, _wait_transaction(client, transaction_id)


def _successful(tx: dict) -> bool:
    lifecycle = tx.get("lifecycle", {})
    receipts = tx.get("consensus_data", {}).get("leader_receipt", [])
    if isinstance(receipts, dict):
        receipts = [receipts]
    return (
        lifecycle.get("state") == "finalized"
        and lifecycle.get("outcome", "accepted") in {"accepted", "success"}
        and bool(receipts)
        and receipts[0].get("execution_result") == "SUCCESS"
    )


@pytest.fixture(scope="module")
def glsim_url():
    port = _free_port()
    executable = ROOT / ".venv" / "Scripts" / "glsim.exe"
    if not executable.exists():
        pytest.skip("GLSim executable is not installed")
    process = subprocess.Popen(
        [
            str(executable),
            "--port",
            str(port),
            "--validators",
            "3",
            "--max-rotations",
            "2",
            "--chain-id",
            "61997",
            "--no-browser",
            "--seed",
            "rightsrail-v23-timestamp",
        ],
        cwd=ROOT,
        env={
            **os.environ,
            # Keep this probe isolated from the shared user cache.  The
            # existing RC5 tree remains the input; only extracted/cache
            # writes are redirected into the project-local test root.
            "USERPROFILE": str(ROOT / ".glsim-home"),
            "GENVM_PREBUILT_DIR": str(
                Path.home() / ".cache" / "gltest-direct" / "trees-v2" / "v0.6.0-rc5"
            ),
        },
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    url = f"http://127.0.0.1:{port}/api"
    deadline = time.time() + 30
    try:
        while time.time() < deadline:
            try:
                if _rpc(url, "ping", []) == "pong":
                    yield url
                    return
            except Exception:
                time.sleep(0.25)
        output = process.stdout.read() if process.stdout else ""
        pytest.fail("GLSim did not become ready within 30 seconds\n" + output)
    finally:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()


def test_v23_validity_windows_use_documented_genvm_datetime(glsim_url):
    source_path = ROOT / "contracts" / "rightsrail.py"
    source = source_path.read_bytes()
    assert hashlib.sha256(source).hexdigest().upper() == EXPECTED_SOURCE_SHA

    chain = copy.deepcopy(localnet)
    chain.id = 61997
    chain.rpc_urls = {"default": {"http": [glsim_url]}}
    account = Account.from_key(LOCAL_KEY)
    client = GenLayerClient(chain, account=account)

    deployment_id = client.deploy_contract(source, account=account, args=[], kwargs={})
    deployment = _wait_transaction(client, deployment_id)
    deployment_error = json.dumps(deployment, default=str)
    if "runner py-genlayer:" in deployment_error and "not under" in deployment_error:
        pytest.skip(
            "GLSIM_RUNTIME_BLOCKER: exact V2.3 RC5 runner is unavailable in the local GLSim tree; "
            + deployment_error
        )
    assert _successful(deployment), deployment_error
    address = deployment.get("data", {}).get("contract_address") or deployment["to_address"]
    assert address and not address.endswith("0" * 40)

    cases = [
        ("before", VALID_FROM - 1, BASE_TIME, False, "request-before"),
        ("at_start", VALID_FROM, BASE_TIME, True, "request-at-start"),
        ("after_expiry", VALID_UNTIL + 1, "2026-01-02T00:00:01Z", False, "request-after-expiry"),
    ]
    observations = []
    for label, _valid_from, datetime_value, should_succeed, request_id in cases:
        policy_id = f"policy-{label}"
        create_id, create_tx = _write(
            client,
            address,
            account,
            "create_policy",
            _policy_args(policy_id, VALID_FROM, VALID_UNTIL, account.address),
            BASE_TIME,
        )
        assert _successful(create_tx), json.dumps(create_tx, default=str)
        freeze_id, freeze_tx = _write(
            client, address, account, "freeze_policy", [policy_id], BASE_TIME
        )
        assert _successful(freeze_tx), json.dumps(freeze_tx, default=str)
        submit_id, submit_tx = _write(
            client,
            address,
            account,
            "submit_usage_request",
            _request_args(request_id, policy_id),
            datetime_value,
            value=10,
        )
        succeeded = _successful(submit_tx)
        if should_succeed:
            assert succeeded, json.dumps(submit_tx, default=str)
        else:
            assert not succeeded, json.dumps(submit_tx, default=str)
            error_text = json.dumps(submit_tx, default=str)
            assert "outside its validity window" in error_text
        observations.append(
            {
                "case": label,
                "policy_id": policy_id,
                "valid_from": VALID_FROM,
                "valid_until": VALID_UNTIL,
                "genvm_datetime": datetime_value,
                "request_id": request_id,
                "create_tx": create_id,
                "freeze_tx": freeze_id,
                "submit_tx": submit_id,
                "submit_succeeded": succeeded,
                "execution_error": None if succeeded else "policy is outside its validity window",
            }
        )

    zero_policy = "policy-zero-sentinel"
    create_id, create_tx = _write(
        client,
        address,
        account,
        "create_policy",
        _policy_args(zero_policy, 0, 0, account.address),
        BASE_TIME,
    )
    assert _successful(create_tx), json.dumps(create_tx, default=str)
    freeze_id, freeze_tx = _write(
        client, address, account, "freeze_policy", [zero_policy], BASE_TIME
    )
    assert _successful(freeze_tx), json.dumps(freeze_tx, default=str)
    submit_id, submit_tx = _write(
        client,
        address,
        account,
        "submit_usage_request",
        _request_args("request-zero-sentinel", zero_policy),
        "1970-01-01T00:00:00Z",
        value=10,
    )
    assert _successful(submit_tx), json.dumps(submit_tx, default=str)
    observations.append(
        {
            "case": "zero_zero_at_epoch",
            "policy_id": zero_policy,
            "valid_from": 0,
            "valid_until": 0,
            "genvm_datetime": "1970-01-01T00:00:00Z",
            "request_id": "request-zero-sentinel",
            "create_tx": create_id,
            "freeze_tx": freeze_id,
            "submit_tx": submit_id,
            "submit_succeeded": True,
            "execution_error": None,
        }
    )

    print(
        json.dumps(
            {"glsim_url": glsim_url, "contract_address": address, "observations": observations},
            indent=2,
        )
    )
