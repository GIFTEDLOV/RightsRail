"""Read-only Studio-dev probe for the installed genlayer-test simulation path.

This script intentionally never calls ContractFunction.transact, write_contract,
deploy, or eth_sendRawTransaction.  It probes the genlayer-test analyzer and the
underlying genlayer-py simulate_write_contract path, both of which use sim_call.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from eth_account import Account
from genlayer_py import create_client
from genlayer_py.chains import studio_devnet
from gltest.contracts import stats_collector as stats_module
from gltest.contracts.contract import Contract
from gltest_cli.config.general import get_general_config

RPC = "https://studio-dev.genlayer.com/api"
CONTRACT = "0xfB3335350b0e02ceFb384753990E9B377B4BCB1F"
POLICY_ID = "policy-v23-lumen-finch-001"
REQUESTER = Account.create()
REQUEST_ID = "v23-request-case-a-gltest-context"

ARGS = [
    REQUEST_ID,
    POLICY_ID,
    1,
    "Commercial technology newsletter editorial use",
    "newsletter",
    "Independent editorial article with no endorsement or recommendation.",
    "da782460a0de765d49ebcbe4f116cfab0c42b42d3aea99e4bfc3763e5b63f223",
    52132,
    "image/png",
    "",
    "Image courtesy of Lumen Finch Studio",
]


def safe(value: Any) -> Any:
    if isinstance(value, bytes):
        return "0x" + value.hex()
    if isinstance(value, (list, tuple)):
        return [safe(item) for item in value]
    if isinstance(value, dict):
        return {
            str(key): "[REDACTED]"
            if any(
                token in str(key).lower()
                for token in ("private", "secret", "mnemonic", "password")
            )
            else safe(item)
            for key, item in value.items()
        }
    if hasattr(value, "__dict__") and not isinstance(value, type):
        return safe(vars(value))
    return value


def describe(error: BaseException) -> str:
    return f"{type(error).__name__}: {error}"


def read_snapshot(client: Any) -> dict[str, Any]:
    reads = {
        "policy_ids": ("get_policy_ids", [0, 64]),
        "request_ids": ("get_request_ids", [0, 64]),
        "evidence_ids": ("get_evidence_ids", [0, 64]),
        "adjudication_ids": ("get_adjudication_ids", [0, 64]),
        "permit_ids": ("get_permit_ids", [0, 64]),
        "settlement_ids": ("get_settlement_ids", [0, 64]),
        "accounting": ("get_accounting_status", []),
    }
    result: dict[str, Any] = {}
    for key, (method, args) in reads.items():
        try:
            result[key] = safe(
                client.read_contract(
                    address=CONTRACT,
                    function_name=method,
                    account=REQUESTER,
                    args=args,
                )
            )
        except Exception as error:  # pragma: no cover - diagnostic output
            result[key] = {"error": describe(error)}
    return result


def main() -> None:
    client = create_client(chain=studio_devnet, endpoint=RPC, account=REQUESTER)

    captured: list[dict[str, Any]] = []
    original_make_request = client.provider.make_request

    def capture(method: str, params: Any):
        item = None
        if method in {"sim_call", "sim_estimateTransactionFees"}:
            item = {"method": method, "params": safe(params)}
            captured.append(item)
        try:
            response = original_make_request(method, params)
        except Exception as error:
            if item is not None:
                item["exception"] = describe(error)
            raise
        if item is not None:
            result = response.get("result") if isinstance(response, dict) else None
            item["response_summary"] = {
                "has_result": "result" in response if isinstance(response, dict) else False,
                "error": safe(response.get("error")) if isinstance(response, dict) else None,
                "execution_result": (
                    result.get("execution_result") if isinstance(result, dict) else None
                ),
                "result": result.get("result") if isinstance(result, dict) else None,
                "mode": result.get("mode") if isinstance(result, dict) else None,
                "contract_state_hash": (
                    result.get("contract_state_hash") if isinstance(result, dict) else None
                ),
            }
        return response

    client.provider.make_request = capture

    block = client.provider.make_request("eth_getBlockByNumber", ["latest", False])
    raw_timestamp = block["result"]["timestamp"]
    chain_timestamp = int(raw_timestamp, 16)
    chain_datetime = datetime.fromtimestamp(chain_timestamp, UTC).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )

    before = read_snapshot(client)
    result: dict[str, Any] = {
        "chain_timestamp_raw": raw_timestamp,
        "chain_timestamp": chain_timestamp,
        "chain_datetime": chain_datetime,
        "sender": REQUESTER.address,
        "request_id": REQUEST_ID,
        "value": 10,
        "before": before,
        "gltest_analyze": {},
        "exact_payable_simulate_write": {},
        "exact_payable_fee_estimate": {},
        "captured_rpc": captured,
    }

    # Exercise the installed gltest analyzer.  This is read-only, but its
    # implementation intentionally has no `value` parameter for payable writes.
    schema = {"methods": {"submit_usage_request": {"readonly": False}}}
    contract = Contract.new(CONTRACT, schema, account=REQUESTER)
    config = get_general_config()
    config.plugin_config.artifacts_dir = Path(".genlayer-cache")
    original_stats_client = stats_module.get_gl_client
    stats_module.get_gl_client = lambda: client
    try:
        try:
            analyzed = contract.submit_usage_request(args=ARGS).analyze(
                provider="openai",
                model="gpt-4o",
                runs=1,
                genvm_datetime=chain_datetime,
            )
            analyzed_safe = safe(analyzed)
            analyzer_ok = (
                analyzed_safe.get("server_error_runs", 0) == 0
                and analyzed_safe.get("successful_runs", 0) == 1
            )
            result["gltest_analyze"] = {
                "status": "PASS" if analyzer_ok else "COMPLETED_WITH_SERVER_ERROR",
                "result": analyzed_safe,
            }
        except Exception as error:
            result["gltest_analyze"] = {"status": "FAIL", "error": describe(error)}
    finally:
        stats_module.get_gl_client = original_stats_client

    # Exercise the exact payable, no-write path.  This is the SDK primitive used
    # by the analyzer and sends the transaction context to Studio-dev sim_call.
    try:
        simulated = client.simulate_write_contract(
            address=CONTRACT,
            function_name="submit_usage_request",
            account=REQUESTER,
            args=ARGS,
            kwargs={},
            value=10,
            sim_config={"genvm_datetime": chain_datetime},
        )
        result["exact_payable_simulate_write"] = {
            "status": "PASS",
            "result": safe(simulated),
        }
    except Exception as error:
        result["exact_payable_simulate_write"] = {
            "status": "FAIL",
            "error": describe(error),
        }

    try:
        estimated = client.estimate_transaction_fees_for_write(
            address=CONTRACT,
            function_name="submit_usage_request",
            account=REQUESTER,
            args=ARGS,
            kwargs={},
            value=10,
            sim_config={"genvm_datetime": chain_datetime},
        )
        result["exact_payable_fee_estimate"] = {
            "status": "PASS",
            "result": safe(estimated),
        }
    except Exception as error:
        result["exact_payable_fee_estimate"] = {
            "status": "FAIL",
            "error": describe(error),
        }

    after = read_snapshot(client)
    result["after"] = after
    result["state_unchanged"] = before == after
    result["captured_rpc"] = captured
    result["sim_call_count"] = sum(item["method"] == "sim_call" for item in captured)
    result["sim_estimate_count"] = sum(
        item["method"] == "sim_estimateTransactionFees" for item in captured
    )
    result["sim_contexts"] = [
        item["params"][0].get("sim_config")
        for item in captured
        if item["params"] and isinstance(item["params"][0], dict)
    ]
    output = Path("docs/provenance/simulations/gltest-studio-timestamp-probe.json")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
