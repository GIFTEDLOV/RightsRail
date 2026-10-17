"""Stable SDK isolation and Windows fd handling; no contract behavior is mocked here."""
from __future__ import annotations

import copy
import importlib
import os
import shutil
import sys
from pathlib import Path

from gltest.direct import loader, sdk_loader, wasi_mock

ROOT = Path(__file__).resolve().parents[1]
VERSION = "v0.2.16"
sdk_loader.CACHE_DIR = ROOT / ".genlayer-cache" / "stable-direct"
sdk_loader.CACHE_DIR.mkdir(parents=True, exist_ok=True)
sdk_loader.get_latest_version = lambda: VERSION

# Reuse the exact official bundle already validated by genvm-lint.
linter_cache = Path.home() / ".cache" / "genvm-linter"
for namespace in (f"genlayerlabs-genvm-{VERSION}", VERSION):
    bundle = linter_cache / f"genvm-universal-{namespace}.tar.xz"
    target = sdk_loader.CACHE_DIR / f"genvm-universal-{VERSION}.tar.xz"
    if bundle.is_file() and not target.exists():
        shutil.copyfile(bundle, target)
    extracted = linter_cache / "extracted" / namespace
    if extracted.is_dir():
        shutil.copytree(extracted, sdk_loader.CACHE_DIR / "extracted" / VERSION, dirs_exist_ok=True)


def _inject_message_to_fd0(vm):
    """An anonymous pipe has no Windows open-file deletion race."""
    from genlayer.py import calldata
    from genlayer.py.types import Address

    def address(value):
        return Address(value) if isinstance(value, bytes) else value

    encoded = calldata.encode({
        "contract_address": address(vm._contract_address),
        "sender_address": address(vm.sender), "origin_address": address(vm.origin),
        "stack": [], "value": vm._value, "datetime": vm._datetime,
        "is_init": False, "chain_id": vm._chain_id, "entry_kind": 0,
        "entry_data": b"", "entry_stage_data": None,
    })
    read_fd, write_fd = os.pipe()
    try:
        os.write(write_fd, encoded)
        os.close(write_fd)
        write_fd = -1
        vm._original_stdin_fd = os.dup(0)
        os.dup2(read_fd, 0)
    finally:
        os.close(read_fd)
        if write_fd >= 0:
            os.close(write_fd)


if sys.platform == "win32":
    loader._inject_message_to_fd0 = _inject_message_to_fd0

# Consensus serializes leader output before deterministic code annotates it.
# Copy only the retained test snapshot so explicit validator replay does too.
original_patch_nondet = loader._patch_run_nondet_for_direct_mode


def _patch_nondet():
    original_patch_nondet()
    vm_module = importlib.import_module("genlayer.gl.vm")
    base = getattr(vm_module.run_nondet, "_rightsrail_base", vm_module.run_nondet)

    def run(leader, validator, /, **kwargs):
        result = base(leader, validator, **kwargs)
        vm = wasi_mock.get_vm()
        stored, leader_fn, validator_fn = vm._captured_validators[-1]
        vm._captured_validators[-1] = copy.deepcopy(stored), leader_fn, validator_fn
        return result

    run._rightsrail_base = base
    vm_module.run_nondet = run


loader._patch_run_nondet_for_direct_mode = _patch_nondet

original_load_module = loader._load_module


def _load_module(path):
    # A real VM starts a fresh module registry for each deployment.
    importlib.import_module("genlayer.gl.genvm_contracts").__known_contract__ = None
    return original_load_module(path)


loader._load_module = _load_module
