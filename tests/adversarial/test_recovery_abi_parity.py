"""Static ABI shape gate with deterministic regeneration after gltest cleanup."""
import ast
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[2]


def _is_public_decorator(decorator: ast.expr) -> bool:
    node = decorator
    while isinstance(node, ast.Attribute):
        if node.attr == "public" and isinstance(node.value, ast.Name) and node.value.id == "gl":
            return True
        node = node.value
    return False


def _load_abi() -> dict:
    artifact = ROOT / "artifacts/rightsrail.abi.json"
    if not artifact.exists():
        generator = ROOT / ".venv/Scripts/genvm-lint.exe"
        result = subprocess.run(
            [str(generator), "schema", "contracts/rightsrail.py", "-o", str(artifact), "--json"],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr or result.stdout
    return json.loads(artifact.read_text(encoding="utf-8"))


def test_public_method_names_equal_candidate_abi():
    contract = ast.parse((ROOT / "contracts/rightsrail.py").read_text())
    klass = next(x for x in contract.body if isinstance(x, ast.ClassDef) and x.name == "RightsRail")
    names = set()
    for method in klass.body:
        if not isinstance(method, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        if any(_is_public_decorator(decorator) for decorator in method.decorator_list):
            names.add(method.name)
    abi = _load_abi()
    assert set(abi["methods"]) == names
    assert len(names) == 35
    assert abi["methods"]["refund_unadjudicated_request"] == {
        "params": [["request_id", "string"]],
        "kwparams": {},
        "readonly": False,
        "ret": "string",
        "payable": False,
    }
