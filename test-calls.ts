// Test file to verify function call detection in knowledge graph

export function foo() {
  return "foo";
}

export function bar() {
  foo(); // bar calls foo
  return "bar";
}

export function baz() {
  foo(); // baz calls foo
  bar(); // baz calls bar
  return "baz";
}

export async function main() {
  baz(); // main calls baz
  const result = foo(); // main calls foo
  return result;
}
