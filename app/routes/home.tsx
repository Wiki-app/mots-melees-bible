import { useState, useEffect, useCallback } from "react";
import type { Route } from "./+types/home";
import { LANGUAGES, type BiblicalWord } from "~/data/biblical-words";
import { generateWordSearch, checkWordSelection, type Position, type PlacedWord } from "~/utils/word-search-generator";
import { speakWord } from "~/utils/speech-synthesis";
import { getAlphabetForLanguage, selectRandomWords } from "~/utils/alphabet-utils";
import { Button } from "~/components/ui/button/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "~/components/ui/dialog/dialog";
import { Volume2, Languages, RefreshCw, Share2 } from "lucide-react";
import styles from "./home.module.css";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Bible Word Search - Mots Mêlés de la Bible" },
    { name: "description", content: "Interactive biblical word search game for children aged 6-10" },
  ];
}

const GRID_ROWS = 10;
const GRID_COLS = 8;
const WORDS_PER_GAME = 8;
const HISTORY_SIZE = 20;

export default function Home() {
  const [currentLang, setCurrentLang] = useState("fr");
  const [difficulty, setDifficulty] = useState<"easy" | "hard" | null>("easy");
  const [gameStarted, setGameStarted] = useState(false);
  const [grid, setGrid] = useState<string[][]>([]);
  const [placedWords, setPlacedWords] = useState<PlacedWord[]>([]);
  const [selectedWords, setSelectedWords] = useState<BiblicalWord[]>([]);
  const [foundWords, setFoundWords] = useState<Set<string>>(new Set());
  const [selectedPositions, setSelectedPositions] = useState<Position[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentVerse, setCurrentVerse] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [wordHistory, setWordHistory] = useState<string[]>([]);
  const [speakingWord, setSpeakingWord] = useState<string | null>(null);
  const [clickMode, setClickMode] = useState(false);
  const [currentWord, setCurrentWord] = useState<string>("");
  const [errorFlash, setErrorFlash] = useState(false);
  const [alreadyFoundFlash, setAlreadyFoundFlash] = useState(false);

  const langData = LANGUAGES[currentLang];

  const startNewGame = useCallback(() => {
    if (!difficulty) return;

    const alphabet = getAlphabetForLanguage(currentLang);
    const selected = selectRandomWords(langData.words, WORDS_PER_GAME, wordHistory);

    const wordStrings = selected.map((w) => w.word);
    const { grid: newGrid, placedWords: newPlacedWords } = generateWordSearch(
      wordStrings,
      GRID_ROWS,
      GRID_COLS,
      difficulty,
      alphabet,
    );

    setGrid(newGrid);
    setPlacedWords(newPlacedWords);
    setSelectedWords(selected);
    setFoundWords(new Set());
    setSelectedPositions([]);
    setCurrentVerse(null);
    setShowCelebration(false);
    setGameStarted(true);
    setClickMode(false);
    setCurrentWord("");
    setErrorFlash(false);
    setAlreadyFoundFlash(false);

    // Update history
    const newHistory = [...wordHistory, ...wordStrings].slice(-HISTORY_SIZE * WORDS_PER_GAME);
    setWordHistory(newHistory);
  }, [difficulty, currentLang, langData.words, wordHistory]);

  const handleCellMouseDown = (row: number, col: number) => {
    setIsDragging(true);
    setClickMode(false);
    setSelectedPositions([{ row, col }]);
    setCurrentWord(grid[row][col]);
  };

  const getDirection = (from: Position, to: Position): { dx: number; dy: number } | null => {
    const dx = to.col - from.col;
    const dy = to.row - from.row;

    // Check if it's a valid direction (horizontal, vertical, or diagonal)
    if (dx === 0 && dy === 0) return null; // Same cell
    if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return null; // Not a valid diagonal

    // Normalize direction to -1, 0, or 1
    return {
      dx: dx === 0 ? 0 : dx / Math.abs(dx),
      dy: dy === 0 ? 0 : dy / Math.abs(dy),
    };
  };

  const isInSameDirection = (positions: Position[], newPos: Position): boolean => {
    if (positions.length === 0) return true;
    if (positions.length === 1) {
      // Second position establishes direction
      return getDirection(positions[0], newPos) !== null;
    }

    // Check if new position continues in the same direction
    const firstPos = positions[0];
    const direction = getDirection(firstPos, positions[1]);
    if (!direction) return false;

    const expectedRow = firstPos.row + direction.dy * positions.length;
    const expectedCol = firstPos.col + direction.dx * positions.length;

    return newPos.row === expectedRow && newPos.col === expectedCol;
  };

  const handleCellMouseEnter = (row: number, col: number) => {
    if (!isDragging) return;

    const lastPos = selectedPositions[selectedPositions.length - 1];
    if (!lastPos || (lastPos.row === row && lastPos.col === col)) return;

    // Check if this position is already selected
    const alreadySelected = selectedPositions.some((p) => p.row === row && p.col === col);
    if (alreadySelected) return;

    const newPos = { row, col };

    // Check if the new position continues in the same direction
    if (!isInSameDirection(selectedPositions, newPos)) return;

    setSelectedPositions((prev) => [...prev, newPos]);
    setCurrentWord((prev) => prev + grid[row][col]);
  };

  const handleCellClick = (row: number, col: number) => {
    if (isDragging) return;

    // Clear error states FIRST
    setErrorFlash(false);
    setAlreadyFoundFlash(false);

    // Enable click mode
    setClickMode(true);

    const newPos = { row, col };
    const exists = selectedPositions.findIndex((p) => p.row === row && p.col === col);

    if (exists >= 0) {
      // Deselect: only allow removing the last cell
      if (exists === selectedPositions.length - 1) {
        const newPositions = selectedPositions.slice(0, -1);
        const newWord = newPositions.map((p) => grid[p.row][p.col]).join("");
        setSelectedPositions(newPositions);
        setCurrentWord(newWord);
      }
    } else {
      // Select cell: check if it continues in the same direction
      if (isInSameDirection(selectedPositions, newPos)) {
        const newPositions = [...selectedPositions, newPos];
        const newWord = newPositions.map((p) => grid[p.row][p.col]).join("");
        setSelectedPositions(newPositions);
        setCurrentWord(newWord);
      }
    }
  };

  const validateWord = useCallback(() => {
    if (selectedPositions.length === 0) return;

    const matchedWord = checkWordSelection(selectedPositions, placedWords);

    if (matchedWord) {
      if (foundWords.has(matchedWord.word)) {
        setAlreadyFoundFlash(true);
        setTimeout(() => setAlreadyFoundFlash(false), 600);
        setSelectedPositions([]);
        setCurrentWord("");
        return;
      }

      const wordData = selectedWords.find((w) => w.word.toUpperCase() === matchedWord.word);
      if (wordData) {
        setFoundWords((prev) => new Set([...prev, matchedWord.word]));
        setCurrentVerse(wordData.verse);

        if (foundWords.size + 1 === WORDS_PER_GAME) {
          setTimeout(() => setShowCelebration(true), 800);
        }
      }
    } else {
      setErrorFlash(true);
      setTimeout(() => setErrorFlash(false), 600);
    }

    setSelectedPositions([]);
    setCurrentWord("");
    setClickMode(false);
  }, [selectedPositions, placedWords, foundWords, selectedWords, grid]);

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);

    validateWord();
  };

  const handleValidateClick = () => {
    validateWord();
  };

  const handleClearSelection = () => {
    setSelectedPositions([]);
    setCurrentWord("");
    setClickMode(false);
  };

  const handleSpeak = (word: string) => {
    setSpeakingWord(word);
    speakWord(word, currentLang, langData.voiceLocales);
    setTimeout(() => setSpeakingWord(null), 1000);
  };

  const isCellSelected = (row: number, col: number) => {
    return selectedPositions.some((p) => p.row === row && p.col === col);
  };

  const isCellFound = (row: number, col: number) => {
    return placedWords.some(
      (pw) => foundWords.has(pw.word) && pw.positions.some((p) => p.row === row && p.col === col),
    );
  };

  const handleLanguageChange = (lang: string) => {
    setCurrentLang(lang);
    setDifficulty(null);
    setGameStarted(false);
    setWordHistory([]);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    window.addEventListener("touchend", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchend", handleGlobalMouseUp);
    };
  }, [isDragging, selectedPositions, placedWords, foundWords, selectedWords]);

  // Load voices
  useEffect(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  useEffect(() => {
    if (difficulty) {
      startNewGame();
    }
  }, [difficulty]);

  if (!gameStarted || !difficulty) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <img src="/logo-minilek.svg" alt="MiniLEK" className={styles.logo} />
          <div className={styles.controls}>
            <Select value={currentLang} onValueChange={handleLanguageChange}>
              <SelectTrigger style={{ minWidth: "150px" }}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.values(LANGUAGES).map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className={styles.gameArea}>
          <div className={styles.difficultySelector}>
            <h2 className={styles.difficultyTitle}>{langData.ui.selectDifficulty}</h2>
            <div className={styles.difficultyButtons}>
              <div
                className={styles.difficultyCard}
                data-selected={difficulty === "easy"}
                onClick={() => {
                  setDifficulty("easy");
                  if (difficulty === "easy") {
                    startNewGame();
                  }
                }}
              >
                <h3 className={styles.difficultyLabel}>🟢 {langData.ui.easy}</h3>
                <p className={styles.difficultyInfo}>{langData.ui.easyModeInfo}</p>
                <p className={styles.directionsTitle}>{langData.ui.directionsAllowed}</p>
                <div className={styles.directionIcons}>
                  <span className={styles.directionIcon}>→</span>
                  <span className={styles.directionIcon}>↓</span>
                  <span className={styles.directionIcon}>↘</span>
                </div>
              </div>

              <div
                className={styles.difficultyCard}
                data-selected={difficulty === "hard"}
                onClick={() => {
                  setDifficulty("hard");
                  if (difficulty === "hard") {
                    startNewGame();
                  }
                }}
              >
                <h3 className={styles.difficultyLabel}>🔴 {langData.ui.hard}</h3>
                <p className={styles.difficultyInfo}>{langData.ui.hardModeInfo}</p>
                <p className={styles.directionsTitle}>{langData.ui.directionsAllowed}</p>
                <div className={styles.directionIcons}>
                  <span className={styles.directionIcon}>→</span>
                  <span className={styles.directionIcon}>←</span>
                  <span className={styles.directionIcon}>↓</span>
                  <span className={styles.directionIcon}>↑</span>
                  <span className={styles.directionIcon}>↘</span>
                  <span className={styles.directionIcon}>↙</span>
                  <span className={styles.directionIcon}>↗</span>
                  <span className={styles.directionIcon}>↖</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{langData.ui.title}</h1>
        <div className={styles.controls}>
          <Button variant="outline" onClick={() => setGameStarted(false)} className={styles.button}>
            <Languages size={20} />
            {langData.ui.changeLanguage}
          </Button>
          <Button onClick={startNewGame} className={styles.button1}>
            <RefreshCw size={20} />
            {langData.ui.newGame}
          </Button>
        </div>
      </div>

      <div className={styles.gameArea}>
        <div className={styles.progressBar}>
          <div className={styles.progressHeader}>
            <img src="/minilek-miniature.svg" alt="" className={styles.minilekIcon} />
            <p className={styles.progressLabel}>
              {langData.ui.foundWords}: {foundWords.size} / {WORDS_PER_GAME}
            </p>
          </div>
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${(foundWords.size / WORDS_PER_GAME) * 100}%` }}>
              {foundWords.size > 0 && `${foundWords.size}/${WORDS_PER_GAME}`}
            </div>
          </div>
        </div>

        <div className={styles.wordList}>
          {selectedWords.map((wordData, idx) => {
            const isFound = foundWords.has(wordData.word.toUpperCase());
            return (
              <div key={idx} className={styles.wordItem} data-found={isFound}>
                <span className={styles.wordEmoji}>{wordData.emoji}</span>
                <span className={styles.wordText}>{wordData.word}</span>
                <button
                  className={styles.speakButton}
                  onClick={() => handleSpeak(wordData.word)}
                  data-speaking={speakingWord === wordData.word}
                  aria-label={`${langData.ui.pronounce || "Pronounce"} ${wordData.word}`}
                >
                  <Volume2 size={20} />
                </button>
              </div>
            );
          })}
        </div>

        {(clickMode || isDragging) && currentWord && (
          <div className={styles.currentWordDisplay} role="status" aria-live="polite">
            <div className={styles.currentWordLabel}>{langData.ui.currentWord || "Current word"}:</div>
            <div className={styles.currentWordText}>{currentWord}</div>
            {clickMode && (
              <div className={styles.currentWordActions}>
                <Button size="sm" onClick={handleValidateClick}>
                  {langData.ui.validate || "Validate"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearSelection}>
                  {langData.ui.clear || "Clear"}
                </Button>
              </div>
            )}
          </div>
        )}

        {errorFlash && (
          <div className={styles.feedbackMessage} data-type="error">
            {langData.ui.tryAgain || "Try again!"}
          </div>
        )}

        {alreadyFoundFlash && (
          <div className={styles.feedbackMessage} data-type="already-found">
            {langData.ui.alreadyFound || "Already found!"}
          </div>
        )}

        <div
          className={styles.grid}
          style={{
            gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
            gridTemplateRows: `repeat(${GRID_ROWS}, 1fr)`,
          }}
          data-error={errorFlash}
          data-already-found={alreadyFoundFlash}
        >
          {grid.map((row, rowIdx) =>
            row.map((letter, colIdx) => (
              <div
                key={`${rowIdx}-${colIdx}`}
                className={styles.cell}
                data-selected={isCellSelected(rowIdx, colIdx)}
                data-found={isCellFound(rowIdx, colIdx)}
                onMouseDown={() => handleCellMouseDown(rowIdx, colIdx)}
                onMouseEnter={() => handleCellMouseEnter(rowIdx, colIdx)}
                onClick={() => handleCellClick(rowIdx, colIdx)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handleCellMouseDown(rowIdx, colIdx);
                }}
                onTouchMove={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  const element = document.elementFromPoint(touch.clientX, touch.clientY);
                  if (element && element.classList.contains(styles.cell)) {
                    const cellRow = parseInt(element.getAttribute("data-row") || "0");
                    const cellCol = parseInt(element.getAttribute("data-col") || "0");
                    handleCellMouseEnter(cellRow, cellCol);
                  }
                }}
                data-row={rowIdx}
                data-col={colIdx}
              >
                {letter}
              </div>
            )),
          )}
        </div>

        {currentVerse && (
          <div className={styles.verseDisplay}>
            <p className={styles.verseText}>{currentVerse}</p>
          </div>
        )}
      </div>

      <Dialog open={showCelebration} onOpenChange={setShowCelebration}>
        <DialogContent>
          <DialogHeader>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", justifyContent: "center" }}>
              <img
                src="/minilek-miniature.svg"
                alt="Minilek"
                style={{ width: "48px", height: "48px" }}
                className={styles.img1}
              />
              <DialogTitle>{langData.ui.congratulations}</DialogTitle>
            </div>
            <DialogDescription className={styles.dialogDescription}>{langData.ui.finalMessage}</DialogDescription>
          </DialogHeader>

          <div style={{ padding: "var(--space-4)" }}>
            <div className={styles.wordList}>
              {selectedWords.map((wordData, idx) => (
                <div key={idx} className={styles.wordItem} data-found={true}>
                  <span className={styles.wordEmoji}>{wordData.emoji}</span>
                  <span className={styles.wordText}>{wordData.word}</span>
                </div>
              ))}
            </div>

            <div
              style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-5)" }}
            >
              <Button
                onClick={() => {
                  const url = window.location.href;
                  const shareData = {
                    title: "Bible Word Search - MiniLEK",
                    text: `${langData.ui.shareMessage || "J'ai trouvé tous les mots ! Essaye toi aussi ce jeu de mots mêlés bibliques !"} 🎉`,
                    url: url,
                  };

                  if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
                    navigator.share(shareData).catch((err) => {
                      if (err.name !== "AbortError") {
                        console.error("Error sharing:", err);
                        // Fallback: copy to clipboard
                        navigator.clipboard.writeText(`${shareData.text} ${url}`);
                      }
                    });
                  } else {
                    // Fallback: copy to clipboard
                    const textToCopy = `${shareData.text} ${url}`;
                    navigator.clipboard.writeText(textToCopy).then(() => {
                      alert(langData.ui.linkCopied || "Lien copié dans le presse-papier !");
                    });
                  }
                }}
                variant="outline"
              >
                <Share2 size={20} />
                {langData.ui.shareGame || "Partager le jeu"}
              </Button>

              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center" }}>
                <Button onClick={startNewGame}>{langData.ui.newGame}</Button>
                <Button variant="outline" onClick={() => setGameStarted(false)}>
                  {langData.ui.changeLanguage}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
