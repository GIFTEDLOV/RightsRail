/**
 * Canonical write specification for the live qualification runner.
 *
 * The same object is passed to genlayer-js fee estimation and, after fees are
 * attached, to writeContract. User value is deliberately separate from the
 * protocol fee returned by the SDK.
 */

const PAYABLE_METHOD = "submit_usage_request";

const NONPAYABLE_METHODS = new Set([
  "create_policy",
  "freeze_policy",
  "commit_evidence",
  "authenticate_evidence",
  "adjudicate_usage",
  "settle_request",
]);

export const QUALIFICATION_POLICY_FEE_WEI = 10n;

export function expectedUserValue(method, frozenPolicyFee = QUALIFICATION_POLICY_FEE_WEI) {
  if (method === PAYABLE_METHOD) return BigInt(frozenPolicyFee);
  if (NONPAYABLE_METHODS.has(method)) return 0n;
  throw new Error(`UNSUPPORTED_QUALIFICATION_METHOD:${method}`);
}

export function assertQualificationUserValue(
  method,
  value,
  frozenPolicyFee = QUALIFICATION_POLICY_FEE_WEI,
) {
  if (value === undefined || value === null) {
    throw new Error(`USER_VALUE_REQUIRED:${method}`);
  }
  let actual;
  try {
    actual = BigInt(value);
  } catch {
    throw new Error(`USER_VALUE_INVALID:${method}`);
  }
  const expected = expectedUserValue(method, frozenPolicyFee);
  if (actual !== expected) {
    throw new Error(`USER_VALUE_MISMATCH:${method}:${actual}:${expected}`);
  }
  return actual;
}

export function buildQualificationWriteSpec({
  account,
  address,
  functionName,
  args = [],
  kwargs = {},
  value,
  frozenPolicyFee = QUALIFICATION_POLICY_FEE_WEI,
}) {
  if (typeof address !== "string" || address.length === 0) {
    throw new Error("WRITE_ADDRESS_REQUIRED");
  }
  if (!Array.isArray(args)) throw new Error("WRITE_ARGS_MUST_BE_ARRAY");
  if (kwargs === null || typeof kwargs !== "object" || Array.isArray(kwargs)) {
    throw new Error("WRITE_KWARGS_MUST_BE_OBJECT");
  }
  const normalizedValue = assertQualificationUserValue(functionName, value, frozenPolicyFee);
  return {
    ...(account === undefined ? {} : { account }),
    address,
    functionName,
    args,
    kwargs,
    value: normalizedValue,
  };
}

export function stripFees(write) {
  const { fees: _fees, ...withoutFees } = write;
  return withoutFees;
}
