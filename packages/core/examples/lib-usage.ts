import {
  parseWorkflow,
  validateSchema,
  validateSemantic,
  executeWorkflow,
  MemoryHub,
} from "@duckflux/runtime";

// v0.3: workflow.inputs namespace, inline participants, I/O chain
const yaml = `
name: greet
inputs:
  name:
    type: string
    required: true
flow:
  # Inline participant — no participants block needed
  - type: exec
    as: greeter
    run: sh -c 'name=$(cat -); echo "Hello, $name!"'
    input: workflow.inputs.name
output: greeter.output
`;

const workflow = parseWorkflow(yaml);

const schemaResult = validateSchema(workflow);
if (!schemaResult.valid) {
  console.error("Schema errors:", schemaResult.errors);
  process.exit(1);
}

const semanticResult = await validateSemantic(workflow, ".");
if (!semanticResult.valid) {
  console.error("Semantic errors:", semanticResult.errors);
  process.exit(1);
}

// v0.3: can inject event hub for emit/wait support
const hub = new MemoryHub();

const result = await executeWorkflow(workflow, { name: "World" }, ".", { hub });
console.log("Output:", result.output);
console.log("Success:", result.success);

await hub.close();
