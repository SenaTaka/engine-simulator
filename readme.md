# Engine Simulator

[English](#english) | [日本語](#japanese)

---

## English

A real-time browser-based engine sound simulator that synthesizes realistic engine audio using the Web Audio API's `AudioWorklet`. The engine responds dynamically to throttle input with realistic RPM changes and sound characteristics.

### Demo

Visit the live demo: [https://engine-sim-murex.vercel.app](https://engine-sim-murex.vercel.app)

### Overview

This application consists of three main components:

- **UI (`index.html`)**: RPM display, throttle bar, and parameter controls
- **Control Logic (`app.js`)**: Throttle interpolation, RPM physics, keyboard/touch input handling
- **Sound Synthesis (`engine-processor.js`)**: Harmonic synthesis, noise components, resonance, and distortion processing

### Features

- Engine start/stop control
- Acceleration using keyboard (`SPACE` / `↑` / `W`) or holding the gas pedal button
- Multiple engine presets: **NA / Turbo / VTEC / FA24 Boxer**
- Real-time parameter adjustment:
  - Number of cylinders
  - Idle RPM
  - Redline RPM
  - Inertia (engine response)
  - Noise level
  - Audio perspective (Exterior/Interior/Engine Bay)
  - Compressor effect with adjustable amount
  - Reverb effect with adjustable amount
- Specialized engine characteristics:
  - **VTEC**: Simulates high-cam crossover around 5600 RPM
  - **FA24 Boxer**: Emphasizes low-mid range frequencies with paired pulse sensation and distinctive boxer rumble, including lift-off burble effects
- Gearbox and load modeling:
  - Selectable gears with vehicle speed readout
  - Road load slider to mimic incline/drag
  - Engine load affects RPM response and tone

### Usage

1. Clone this repository to your local machine
2. Start a simple HTTP server in the root directory (required for `AudioWorklet` - `http://` protocol, not `file://`):

```bash
python3 -m http.server 8000
```

3. Open `http://localhost:8000` in your browser
4. Click **Start Engine** to begin audio playback
5. Use keyboard input or hold the pedal button to accelerate, and adjust parameters to hear the sound changes

### Technical Notes

- Mobile devices require user interaction (button tap) to start audio playback
- Sound quality, latency, and performance may vary depending on browser and device capabilities
- Uses Web Audio API's AudioWorklet for low-latency, high-quality audio synthesis

### Future Improvements

- Tire grip/traction loss modeling

### Technologies

- Vanilla JavaScript (no frameworks)
- Web Audio API with AudioWorklet
- HTML5 and CSS3

---

## Japanese

ブラウザ上で動作するリアルタイム・エンジンサウンドシミュレーターです。
`AudioWorklet` を使ってエンジン音を合成し、スロットル入力に応じて RPM と音色が変化します。

### デモ

ライブデモ: [https://engine-sim-murex.vercel.app](https://engine-sim-murex.vercel.app)

### 概要

このアプリは以下の3要素で構成されています。

- **UI (`index.html`)**: RPM 表示、スロットルバー、各種パラメータ入力
- **制御ロジック (`app.js`)**: スロットル補間、RPM 更新、キーボード/タッチ入力処理
- **音声生成 (`engine-processor.js`)**: ハーモニクス合成、ノイズ成分、共鳴、歪み処理

### 機能

- エンジンの開始/停止
- キー操作（`SPACE` / `↑` / `W`）またはガスペダルボタン長押しで加速
- エンジンプリセット: **NA / Turbo / VTEC / FA24 Boxer**
- 以下パラメータのリアルタイム調整
  - 気筒数（Cylinders）
  - アイドル回転数（Idle RPM）
  - レッドライン（Redline RPM）
  - 慣性（Inertia）
  - ノイズ量（Noise）
  - 音響視点（マフラー/車内/エンジンルーム）
  - コンプレッサーエフェクト（量調整可能）
  - リバーブエフェクト（量調整可能）
- 各種エンジン特性:
  - **VTEC**: 約5600rpm付近で高カム側に遷移する音色設計
  - **FA24 Boxer**: 低中域を強調し、リフトオフ時のバーブルを加えたドロドロ系サウンド。低中域のペアドパルス感・ローピングするランブル・ラフな燃焼ノイズを強め、水平対向らしい「ドロドロ」感を実現
- ギア比・車速・負荷モデル:
  - ギア選択と車速表示
  - 登り坂や空気抵抗を模したロード負荷スライダー
  - エンジン負荷がレスポンスと音色に反映

### 使い方

1. このリポジトリをローカルに配置します
2. ルートディレクトリで簡易HTTPサーバーを起動します（`AudioWorklet` の都合で `file://` ではなく `http://` 推奨）:

```bash
python3 -m http.server 8000
```

3. ブラウザで `http://localhost:8000` を開きます
4. **Start Engine** を押して音声を開始します
5. キー入力またはペダルボタンで加速し、設定値を調整して音の変化を確認します

### 技術的注意事項

- モバイル端末では、オーディオ再生開始にユーザー操作（ボタンタップ）が必要です
- ブラウザや端末性能により、音色・遅延・負荷は変わる場合があります
- Web Audio API の AudioWorklet を使用した低遅延・高品質な音声合成を実現

### 今後の改善アイデア

- タイヤグリップ・トラクションの表現強化

### 使用技術

- Vanilla JavaScript（フレームワーク不使用）
- Web Audio API（AudioWorklet使用）
- HTML5 & CSS3
