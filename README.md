# 🧊 Rubik's 3D Tic-Tac-Toe

A stunning, responsive, and premium 3D browser-based game combining the spatial complexity of a 3x3 Rubik's Cube with the classic strategy of Tic-Tac-Toe. Built purely using **HTML5**, **CSS3**, and **Three.js** via ES Modules.

🎮 **Play locally or deploy to host for free!**

---

## 🕹️ How to Play

The game introduces a unique spatial turn-based rule system:

1. **Place Phase**: Click any empty white sticker on the Rubik's Cube to place your glowing player mark (**X** or **O**).
2. **Rotate Phase**: The opponent must immediately rotate a layer (outer face or middle slice) of the cube.
   - *Constraint*: The opponent can **only** rotate a layer that contains the cubie where the mark was just placed. Valid rotation buttons will glow in amber.
3. **Goal**: Align three of your marks in a row on *any single 3x3 face* of the cube. 
4. **Victory Evaluation**: Win checking takes place **after** a layer rotation is completed. 

---

## 🌟 Key Features

* **3D Interactive Viewport**: Rotate, zoom, and inspect the Rubik's Cube in real-time with smooth drag controls.
* **Holographic Direction Previews**: Hovering over layer rotation buttons casts dynamic 3D pointer arrows and glowing ring segments showing the exact direction of rotation.
* **Computer Opponent (Single Player)**: Play against a smart, rule-based computer opponent featuring three difficulty levels:
  - **Easy**: Random placements and rotations.
  - **Medium**: 50% strategic heuristics, 50% random moves.
  - **Hard**: 100% computed minimax heuristic depth search (attempts to block you and secure direct wins).
* **Player Profile Customization**: Modify names in real-time and choose from multiple glowing neon color schemes. Placed marks, victory lines, and environment point lights dynamically re-color in real-time.
* **3D Neon Win Lines**: Forms a glowing emissive 3D cylinder through the winning three stickers once victory is achieved.
* **Post-Game Board Review**: Click "Review Board" to minimize the menu and drag the cube to study the final board configuration.
* **Web Audio Synth Engine**: In-game audio effects dynamically synthesized in the browser (can be muted via the toggle in the header).
* **Universal Screen Responsiveness**: Proportional layout scaling across TVs, desktop screens, tablets, and smartphones (compacts controls and scales camera distance automatically to fit narrow viewports).

---

## 🛠️ Installation & Local Setup

Since this is a fully static client-side web application, you do not need to install Node packages locally.

1. Clone or download this repository.
2. Launch a local web server in the directory. For example, using Python:
   ```bash
   python -m http.server 8000
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:8000
   ```

---

## 🎨 Tech Stack

* **Core Structure**: Semantic HTML5 & Vanilla Javascript (ES6 Modules)
* **Styling**: Responsive CSS3 with custom properties, glassmorphic filters, and neon keyframe animations
* **3D Rendering**: Three.js (v0.160.0) WebGL Engine & OrbitControls
* **Audio**: Browser Web Audio API (Synthesized waves)
* **Fonts**: Outfit & JetBrains Mono (via Google Fonts)
