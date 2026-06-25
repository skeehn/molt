// Test file for knowledge graph inheritance detection

// Base class
export class Animal {
  name: string;
  
  constructor(name: string) {
    this.name = name;
  }
  
  makeSound(): void {
    console.log('Some sound');
  }
}

// Interface
export interface Flyable {
  fly(): void;
  altitude: number;
}

export interface Swimmable {
  swim(): void;
}

// Class with inheritance
export class Dog extends Animal {
  breed: string;
  
  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }
  
  makeSound(): void {
    console.log('Woof!');
  }
}

// Class implementing interface
export class Bird extends Animal implements Flyable {
  altitude: number = 0;
  
  fly(): void {
    this.altitude += 100;
  }
}

// Class implementing multiple interfaces
export class Duck extends Animal implements Flyable, Swimmable {
  altitude: number = 0;
  
  fly(): void {
    this.altitude += 50;
  }
  
  swim(): void {
    console.log('Swimming');
  }
}
