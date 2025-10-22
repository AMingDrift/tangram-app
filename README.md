# Tangram Puzzle Game

English | [中文](README_zh-CN.md)

This is an interactive tangram teaching tool designed for elementary school mathematics classrooms (React / Next.js / TypeScript / Konva).

Online Demo: [https://amingdrift.github.io/tangram-app/](https://amingdrift.github.io/tangram-app/)

## Features

- ➕ Right panel displays 7 puzzle pieces (①~⑦), click the number to rotate 45° clockwise
- 🧩 Drag pieces to the black target area on the canvas to complete the puzzle
- 📐 Collision detection and snapping: Pieces support edge-to-edge snapping, automatically attaching when close to targets
- 📁 Problem management: Supports importing/exporting JSON (example: [tangram-problems.json](artifacts/tangram-problems.json))
- ✍️ Create new problems: Click "+" to create new draggable pieces and save; saved problem targets are displayed in black
- 🕘 Answer playback: View and load historical answers to restore each piece's position
- 🎉 Completion notification: Fireworks effect displayed when all pieces are correctly placed
- 💾 Data persistence: Problems and answers saved in IndexedDB, preserved after refresh

## Tech Stack

- React 19
- Next.js 15+
- TypeScript
- Tailwind CSS
- Konva.js (Graphics library)

## Installation and Running

1. Install dependencies:

    ```bash
    pnpm install
    ```

2. Start the development server:

    ```bash
    pnpm dev
    ```

3. Open <http://localhost:3000> in your browser to view the application

## Educational Use

This tool can help elementary students:

- Recognize and distinguish different geometric shapes
- Understand rotation and transformation of figures
- Develop spatial imagination and logical thinking
- Improve understanding of geometric shape combinations

## File Structure

```
/app
  page.tsx          # Main application page
  layout.tsx        # Page layout
  globals.css       # Global styles
/components
  Sidebar/          # Sidebar (problem list, toolbar, dialogs)
    AnswerList.tsx
    index.tsx
    ProblemList.tsx
    ToolbarButtons.tsx
    Dialog/
      AnswerDeleteDialog.tsx
      AnswerListDialog.tsx
      EditProblemDialog.tsx
      ProblemDeleteDialog.tsx
      SaveProblemDialog.tsx
  TangramCanvas/    # Canvas and puzzle interaction components
    CanvasStage.tsx
    index.tsx
    onDragMoveLogic.md
  ui/               # Reusable UI components (buttons, dialogs, inputs, etc.)
    alert-dialog.tsx
    button.tsx
    confetti.tsx
    dialog.tsx
    input.tsx
    sonner.tsx
    tooltip-button.tsx
    tooltip.tsx
/lib
  tangramUtils.ts
  utils.ts
/stores
  tangramIDBStore.ts
  tangramStore.ts
/artifacts
  tangram-problems.json   # Sample problem bank JSON (upload/download example)
```

## Customization

You can customize by modifying files:

- Shape and color of tangram pieces
- Target outline shape
- Rotation angle
- Snapping logic
- Fireworks effect

## License

MIT
