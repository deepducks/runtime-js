import type { InputDefinition, ValidationError, ValidationResult } from "../model/index";

function coerceValue(value: unknown, typeName: string): unknown {
  if (typeof value !== "string") return value;

  switch (typeName) {
    case "integer": {
      const n = Number(value);
      if (Number.isInteger(n)) return n;
      return value;
    }
    case "number": {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
      return value;
    }
    case "boolean": {
      if (value === "true") return true;
      if (value === "false") return false;
      return value;
    }
    default:
      return value;
  }
}

function matchesType(typeName: string, value: unknown): boolean {
  switch (typeName) {
    case "string":
      return typeof value === "string";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "number":
      return typeof value === "number";
    case "boolean":
      return typeof value === "boolean";
    case "array":
      return Array.isArray(value);
    case "object":
      return typeof value === "object" && value !== null && !Array.isArray(value);
    default:
      return true;
  }
}

function validateConstraints(
  name: string,
  value: unknown,
  definition: InputDefinition,
  errors: ValidationError[],
): void {
  // Enum
  if (definition.enum && !definition.enum.includes(value)) {
    errors.push({
      path: `inputs.${name}`,
      message: `input '${name}' must be one of: ${definition.enum.join(", ")}`,
    });
  }

  // Numeric constraints
  if (typeof value === "number") {
    if (definition.minimum !== undefined && value < definition.minimum) {
      errors.push({
        path: `inputs.${name}`,
        message: `input '${name}' must be >= ${definition.minimum}`,
      });
    }
    if (definition.maximum !== undefined && value > definition.maximum) {
      errors.push({
        path: `inputs.${name}`,
        message: `input '${name}' must be <= ${definition.maximum}`,
      });
    }
  }

  // String constraints
  if (typeof value === "string") {
    if (definition.minLength !== undefined && value.length < definition.minLength) {
      errors.push({
        path: `inputs.${name}`,
        message: `input '${name}' must have at least ${definition.minLength} characters`,
      });
    }
    if (definition.maxLength !== undefined && value.length > definition.maxLength) {
      errors.push({
        path: `inputs.${name}`,
        message: `input '${name}' must have at most ${definition.maxLength} characters`,
      });
    }
    if (definition.pattern) {
      const regex = new RegExp(definition.pattern);
      if (!regex.test(value)) {
        errors.push({
          path: `inputs.${name}`,
          message: `input '${name}' must match pattern: ${definition.pattern}`,
        });
      }
    }
  }

  // Format validation (best-effort)
  if (typeof value === "string" && definition.format) {
    let valid = true;
    switch (definition.format) {
      case "date":
        valid = !Number.isNaN(Date.parse(value)) && /^\d{4}-\d{2}-\d{2}$/.test(value);
        break;
      case "date-time":
        valid = !Number.isNaN(Date.parse(value));
        break;
      case "uri":
        try {
          new URL(value);
        } catch {
          valid = false;
        }
        break;
      case "email":
        valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
        break;
    }
    if (!valid) {
      errors.push({
        path: `inputs.${name}`,
        message: `input '${name}' must be a valid ${definition.format}`,
      });
    }
  }
}

export function validateInputs(
  inputDefs: Record<string, InputDefinition | null> | undefined,
  provided: Record<string, unknown>,
): { result: ValidationResult; resolved: Record<string, unknown> } {
  if (!inputDefs) {
    return {
      result: { valid: true, errors: [] },
      resolved: { ...provided },
    };
  }

  const errors: ValidationError[] = [];
  const resolved: Record<string, unknown> = { ...provided };

  for (const [name, definition] of Object.entries(inputDefs)) {
    // null definition means string type with no schema
    if (definition === null) {
      continue;
    }

    const hasProvided = name in provided;

    if (!hasProvided) {
      if (definition.default !== undefined) {
        resolved[name] = definition.default;
      } else if (definition.required) {
        errors.push({
          path: `inputs.${name}`,
          message: `required input '${name}' is missing`,
        });
      }
      continue;
    }

    // Coerce from CLI string values
    if (definition.type) {
      resolved[name] = coerceValue(provided[name], definition.type);
    }

    const value = resolved[name];

    if (definition.type && !matchesType(definition.type, value)) {
      errors.push({
        path: `inputs.${name}`,
        message: `input '${name}' must be of type '${definition.type}'`,
      });
      continue;
    }

    validateConstraints(name, value, definition, errors);
  }

  return {
    result: { valid: errors.length === 0, errors },
    resolved,
  };
}
