"""Defer gltest's open-stdin tempfile unlink on Windows GLSim child processes.

The pinned gltest RC2 loader duplicates a temporary message file onto fd 0,
closes only the original descriptor, and immediately unlinks the path. Windows
does not permit that unlink while fd 0 still references the file. The fixture
isolates TEMP and removes only its newly created temporary files after GLSim
exits, when the child process has closed every handle.
"""

from __future__ import annotations

import importlib
import os
import tempfile

try:
    # genlayer-py RC2 encodes a call as {"": method, "args": ...}; glsim's
    # decoder currently looks for {"method": method, "args": ...}. Normalize
    # the SDK's selector field before glsim imports and binds the decoder.
    from glsim import tx_decoder as _tx_decoder

    _decode_calldata_bytes = _tx_decoder.decode_calldata_bytes

    def _decode_calldata_bytes_compat(raw: bytes) -> dict:
        decoded = _decode_calldata_bytes(raw)
        if "method" not in decoded and isinstance(decoded.get(""), str):
            decoded["method"] = decoded.pop("")
        return decoded

    _tx_decoder.decode_calldata_bytes = _decode_calldata_bytes_compat
except ImportError:
    pass


try:
    # GLSim records payable value on the transaction but does not place it in
    # the direct VM message context. Keep the payable contract path faithful
    # to the submitted GenLayer payload while its consensus execution runs.
    from glsim import server as _server

    _rpc_eth_send_raw_transaction = _server._rpc_eth_send_raw_transaction

    def _rpc_send_with_message_value(state, engine, params):
        raw_tx = _tx_decoder.decode_raw_transaction(_server._positional(params, 0))
        payload = _tx_decoder.decode_genlayer_payload(raw_tx["data"])
        user_value = payload.get("user_value")
        if user_value is None:
            user_value = raw_tx["value"]
        previous_value = engine.vm._value
        engine.vm._value = int(user_value)
        try:
            return _rpc_eth_send_raw_transaction(state, engine, params)
        finally:
            engine.vm._value = previous_value

    _server._rpc_eth_send_raw_transaction = _rpc_send_with_message_value
    _server.RPC_METHODS["eth_sendRawTransaction"] = _rpc_send_with_message_value
except ImportError:
    pass


try:
    # The RC SDK exposes message context through genlayer.gl, while the
    # installed direct VM refresh still targets its older module layout. Keep
    # the transaction timestamp and sender snapshot aligned after warp().
    from gltest.direct.vm import VMContext as _VMContext

    _original_refresh_gl_message = _VMContext._refresh_gl_message

    def _refresh_gl_message_compat(self) -> None:
        try:
            gl_module = importlib.import_module("genlayer.gl")
        except ModuleNotFoundError:
            try:
                gl_module = importlib.import_module("genlayer")
            except ModuleNotFoundError:
                return _original_refresh_gl_message(self)
        try:
            types_module = importlib.import_module("genlayer.py.types")
        except ModuleNotFoundError:
            types_module = importlib.import_module("genlayer.types")
        address_type = types_module.Address
        u256_type = types_module.u256

        def as_address(value):
            if isinstance(value, address_type):
                return value
            if isinstance(value, bytes):
                return address_type(value)
            if hasattr(value, "as_bytes"):
                return address_type(value.as_bytes)
            return value

        sender = as_address(self.sender)
        origin = as_address(self.origin)
        contract_address = as_address(self._contract_address)
        raw_source = getattr(gl_module, "message_raw", None)
        if raw_source is None:
            raw_source = gl_module.message.raw
        raw = dict(raw_source)
        raw.update(
            {
                "sender_address": sender,
                "origin_address": origin,
                "contract_address": contract_address,
                "value": self._value,
                "chain_id": self._chain_id,
                "datetime": self._datetime,
            }
        )
        gl_module.message_raw = raw
        gl_module.message.raw = raw
        gl_module.message.contract_address = contract_address
        gl_module.message.sender_address = sender
        gl_module.message.origin_address = origin
        gl_module.message.value = u256_type(self._value)
        gl_module.message.chain_id = u256_type(self._chain_id)

    _VMContext._refresh_gl_message = _refresh_gl_message_compat
except ImportError:
    pass


if os.name == "nt":
    _original_unlink = os.unlink
    _temp_root = os.path.normcase(os.path.abspath(tempfile.gettempdir()))

    def _unlink_defer_open_genlayer_temp(path, *args, **kwargs):
        try:
            _original_unlink(path, *args, **kwargs)
        except PermissionError:
            candidate = os.path.normcase(os.path.abspath(os.fspath(path)))
            if not candidate.startswith(_temp_root + os.sep) or not os.path.basename(
                candidate
            ).startswith("tmp"):
                raise
            # The file remains available through fd 0 for the duration of the
            # simulator process; the fixture removes it after all handles close.

    os.unlink = _unlink_defer_open_genlayer_temp
