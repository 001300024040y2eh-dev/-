# Repository instructions

## Project state

This is a dependency-free browser game implemented with HTML, CSS, and JavaScript ES modules. It supports one human player and three AI players.

## Build, test, and lint

- Serve locally: `npm run serve`
- Open `http://localhost:4173`
- Run the full test suite: `npm test`
- Run one test file: `node --test test/game.test.js`
- There is no configured linter or formatter.

## Architecture

- `src/game.js` contains the framework-independent game model: deck creation, shuffling, dealing, card strength, turn rules, passes, and win state.
- `src/app.js` connects the game model to the DOM and schedules AI turns.
- `index.html` is the static entry point; `styles.css` contains the table and card styling.
- `test/game.test.js` uses Node's built-in test runner and imports the game model directly.

## Repository conventions

- Keep game rules in `src/game.js` rather than duplicating turn or card-strength logic in DOM code.
- Joker rules are special: the deck contains two distinct jokers; one can be played only while the player has at least one non-joker card, it cannot end the game, and only 3 can beat it. Implement those conditions in `canPlay`, `compareCards`, and AI selection rather than in DOM code.
- AI turns use a 2–4 second delay to make play feel less instantaneous.
- A round ends after every other active player passes. Clear `tableCard`, then set `currentPlayer` back to `leadPlayer` (the last card player), skipping that player only if their hand is empty.
- Use ES modules and keep browser code free of build-time dependencies.
- Preserve Japanese user-facing text unless an explicit localization change is requested.
