/**
 * Adds two numbers together
 * @param a - The first number
 * @param b - The second number
 * @returns The sum of a and b
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts the second number from the first
 * @param a - The first number
 * @param b - The second number
 * @returns The difference of a and b
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

// Example usage
if (import.meta.main) {
  console.log("Testing add function:");
  console.log(`add(2, 3) = ${add(2, 3)}`);
  console.log(`add(-5, 10) = ${add(-5, 10)}`);
  console.log(`add(0, 0) = ${add(0, 0)}`);
  
  console.log("\nTesting subtract function:");
  console.log(`subtract(5, 3) = ${subtract(5, 3)}`);
  console.log(`subtract(10, -5) = ${subtract(10, -5)}`);
  console.log(`subtract(0, 0) = ${subtract(0, 0)}`);
}
