export interface Position {
  row: number;
  col: number;
}

export interface Direction {
  rowDelta: number;
  colDelta: number;
  name: string;
}

export interface PlacedWord {
  word: string;
  positions: Position[];
  direction: Direction;
}

export const DIRECTIONS: Record<string, Direction> = {
  RIGHT: { rowDelta: 0, colDelta: 1, name: "right" },
  DOWN: { rowDelta: 1, colDelta: 0, name: "down" },
  DIAGONAL_DOWN_RIGHT: { rowDelta: 1, colDelta: 1, name: "diagonal-down-right" },
  LEFT: { rowDelta: 0, colDelta: -1, name: "left" },
  UP: { rowDelta: -1, colDelta: 0, name: "up" },
  DIAGONAL_UP_LEFT: { rowDelta: -1, colDelta: -1, name: "diagonal-up-left" },
  DIAGONAL_DOWN_LEFT: { rowDelta: 1, colDelta: -1, name: "diagonal-down-left" },
  DIAGONAL_UP_RIGHT: { rowDelta: -1, colDelta: 1, name: "diagonal-up-right" },
};

const EASY_DIRECTIONS = [DIRECTIONS.RIGHT, DIRECTIONS.DOWN, DIRECTIONS.DIAGONAL_DOWN_RIGHT];
const HARD_DIRECTIONS = Object.values(DIRECTIONS);

export function generateWordSearch(
  words: string[],
  rows: number,
  cols: number,
  difficulty: "easy" | "hard",
  alphabet: string,
): { grid: string[][]; placedWords: PlacedWord[] } {
  const grid: string[][] = Array(rows)
    .fill(null)
    .map(() => Array(cols).fill(""));
  const placedWords: PlacedWord[] = [];

  const availableDirections = difficulty === "easy" ? EASY_DIRECTIONS : HARD_DIRECTIONS;

  // Shuffle words for random placement order
  const shuffledWords = [...words].sort(() => Math.random() - 0.5);

  for (const word of shuffledWords) {
    const upperWord = word.toUpperCase();
    let placed = false;
    let attempts = 0;
    const maxAttempts = 100;

    while (!placed && attempts < maxAttempts) {
      attempts++;

      // Random starting position
      const startRow = Math.floor(Math.random() * rows);
      const startCol = Math.floor(Math.random() * cols);

      // Random direction
      const direction = availableDirections[Math.floor(Math.random() * availableDirections.length)];

      // Check if word fits
      const positions: Position[] = [];
      let fits = true;

      for (let i = 0; i < upperWord.length; i++) {
        const row = startRow + i * direction.rowDelta;
        const col = startCol + i * direction.colDelta;

        if (row < 0 || row >= rows || col < 0 || col >= cols) {
          fits = false;
          break;
        }

        const existingChar = grid[row][col];
        if (existingChar !== "" && existingChar !== upperWord[i]) {
          fits = false;
          break;
        }

        positions.push({ row, col });
      }

      if (fits) {
        // Place the word
        for (let i = 0; i < upperWord.length; i++) {
          const { row, col } = positions[i];
          grid[row][col] = upperWord[i];
        }

        placedWords.push({ word: upperWord, positions, direction });
        placed = true;
      }
    }
  }

  // Fill empty cells with random letters from alphabet
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (grid[row][col] === "") {
        grid[row][col] = alphabet[Math.floor(Math.random() * alphabet.length)];
      }
    }
  }

  return { grid, placedWords };
}

export function checkWordSelection(selectedPositions: Position[], placedWords: PlacedWord[]): PlacedWord | null {
  if (selectedPositions.length < 2) return null;

  for (const placedWord of placedWords) {
    if (placedWord.positions.length !== selectedPositions.length) continue;

    // Check forward match
    const forwardMatch = placedWord.positions.every((pos, idx) => {
      const selected = selectedPositions[idx];
      return pos.row === selected.row && pos.col === selected.col;
    });

    if (forwardMatch) return placedWord;

    // Check backward match
    const backwardMatch = placedWord.positions.every((pos, idx) => {
      const selected = selectedPositions[selectedPositions.length - 1 - idx];
      return pos.row === selected.row && pos.col === selected.col;
    });

    if (backwardMatch) return placedWord;
  }

  return null;
}
