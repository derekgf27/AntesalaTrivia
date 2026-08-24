import type { Question } from "./types";

export const SAMPLE_QUESTIONS: Question[] = [
  {
    id: "q1",
    text: "Which spirit is the base of a classic Mojito?",
    options: ["Vodka", "Rum", "Gin", "Tequila"],
    correctIndex: 1,
    timeLimitSec: 30,
  },
  {
    id: "q2",
    text: "What does IPA stand for in the beer world?",
    options: [
      "Irish Pale Ale",
      "India Pale Ale",
      "International Porter Association",
      "Italian Pilsner Ale",
    ],
    correctIndex: 1,
    timeLimitSec: 30,
  },
  {
    id: "q3",
    text: "Which country is the origin of tapas culture?",
    options: ["Italy", "Mexico", "Spain", "Portugal"],
    correctIndex: 2,
    timeLimitSec: 30,
  },
  {
    id: "q4",
    text: "A Manhattan is traditionally stirred with which whiskey style?",
    options: ["Scotch", "Irish whiskey", "Bourbon or rye", "Japanese whisky"],
    correctIndex: 2,
    timeLimitSec: 30,
  },
  {
    id: "q5",
    text: "What is the main cheese in a classic Margherita pizza?",
    options: ["Cheddar", "Mozzarella", "Gouda", "Feta"],
    correctIndex: 1,
    timeLimitSec: 30,
  },
  {
    id: "q6",
    text: "Which cocktail is made with gin, Campari, and sweet vermouth?",
    options: ["Negroni", "Old Fashioned", "Cosmopolitan", "Whiskey Sour"],
    correctIndex: 0,
    timeLimitSec: 30,
  },
  {
    id: "q7",
    text: "Espresso literally means what in Italian?",
    options: ["Strong", "Pressed out", "Dark roast", "Quick cup"],
    correctIndex: 1,
    timeLimitSec: 30,
  },
  {
    id: "q8",
    text: "Which fruit is traditionally used to garnish a Margarita?",
    options: ["Orange", "Cherry", "Lime", "Lemon"],
    correctIndex: 2,
    timeLimitSec: 30,
  },
];
