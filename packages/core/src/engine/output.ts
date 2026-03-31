import type { InputDefinition } from "../model/index";

export function validateOutputSchema(
  schema: Record<string, InputDefinition>,
  result: Record<string, unknown>,
): void {
  for (const [fieldName, fieldDef] of Object.entries(schema)) {
    const value = result[fieldName];

    if (value === undefined || value === null) {
      if (fieldDef.required) {
        throw new Error(`output validation failed: required field '${fieldName}' is missing`);
      }
      continue;
    }

    validateValueAgainstField(fieldName, value, fieldDef);
  }
}

function validateValueAgainstField(
  fieldName: string,
  value: unknown,
  fieldDef: InputDefinition,
): void {
  if (fieldDef.type) {
    validateType(fieldName, value, fieldDef.type);
  }

  if (fieldDef.enum !== undefined) {
    if (!fieldDef.enum.some((e) => e === value)) {
      throw new Error(
        `output validation failed: field '${fieldName}' value ${JSON.stringify(value)} is not in enum [${fieldDef.enum.map((e) => JSON.stringify(e)).join(", ")}]`,
      );
    }
  }

  if (typeof value === "string") {
    if (fieldDef.minLength !== undefined && value.length < fieldDef.minLength) {
      throw new Error(
        `output validation failed: field '${fieldName}' length ${value.length} is less than minLength ${fieldDef.minLength}`,
      );
    }
    if (fieldDef.maxLength !== undefined && value.length > fieldDef.maxLength) {
      throw new Error(
        `output validation failed: field '${fieldName}' length ${value.length} exceeds maxLength ${fieldDef.maxLength}`,
      );
    }
    if (fieldDef.pattern !== undefined && !new RegExp(fieldDef.pattern).test(value)) {
      throw new Error(
        `output validation failed: field '${fieldName}' does not match pattern '${fieldDef.pattern}'`,
      );
    }
  }

  if (typeof value === "number") {
    if (fieldDef.minimum !== undefined && value < fieldDef.minimum) {
      throw new Error(
        `output validation failed: field '${fieldName}' value ${value} is less than minimum ${fieldDef.minimum}`,
      );
    }
    if (fieldDef.maximum !== undefined && value > fieldDef.maximum) {
      throw new Error(
        `output validation failed: field '${fieldName}' value ${value} exceeds maximum ${fieldDef.maximum}`,
      );
    }
  }

  if (Array.isArray(value) && fieldDef.items) {
    for (let i = 0; i < value.length; i++) {
      validateValueAgainstField(`${fieldName}[${i}]`, value[i], fieldDef.items);
    }
  }
}

function validateType(fieldName: string, value: unknown, expectedType: string): void {
  switch (expectedType) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`output validation failed: field '${fieldName}' expected string, got ${typeof value}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`output validation failed: field '${fieldName}' expected boolean, got ${typeof value}`);
      }
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new Error(`output validation failed: field '${fieldName}' expected integer, got ${typeof value === "number" ? value : typeof value}`);
      }
      break;
    case "number":
      if (typeof value !== "number") {
        throw new Error(`output validation failed: field '${fieldName}' expected number, got ${typeof value}`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        throw new Error(`output validation failed: field '${fieldName}' expected array, got ${typeof value}`);
      }
      break;
    case "object":
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        throw new Error(`output validation failed: field '${fieldName}' expected object, got ${Array.isArray(value) ? "array" : typeof value}`);
      }
      break;
  }
}
