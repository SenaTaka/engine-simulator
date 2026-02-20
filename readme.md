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

### Architecture

The application follows a layered architecture:

```
┌────────────────────────────────────┐
│  index.html (Presentation Layer)  │
│  UI components, displays, controls │
└────────────────────────────────────┘
                ↓
┌────────────────────────────────────┐
│   app.js (Application Layer)       │
│   - CONFIG: Centralized config     │
│   - Physics engine (RPM, torque)   │
│   - Vehicle dynamics (speed, load) │
│   - Input handling                 │
│   - Audio parameter sync           │
└────────────────────────────────────┘
                ↓
┌────────────────────────────────────┐
│ engine-processor.js (Audio Layer)  │
│ - SynthConstants: Audio parameters │
│ - Harmonic synthesis               │
│ - Multi-band noise generation      │
│ - Resonance modeling               │
│ - Engine mode implementations      │
└────────────────────────────────────┘
```

**Key Design Principles:**
- **Separation of concerns**: UI, logic, and audio synthesis are cleanly separated
- **Configuration over hardcoding**: All tunable parameters are in CONFIG and SynthConstants objects
- **Real-time synthesis**: No audio samples; everything is procedurally generated
- **Modular structure**: Easy to add new engine presets or audio perspectives

### Development

#### Code Structure

- `app.js`: Contains CONFIG object with all application settings (presets, perspectives, vehicle parameters, physics constants)
- `engine-processor.js`: Contains SynthConstants object with all audio synthesis parameters
- `.claude/context.md`: Comprehensive documentation for Claude AI assistance

#### Adding a New Engine Preset

Edit the `CONFIG.presets` object in `app.js`:

```javascript
CONFIG.presets.myEngine = {
  ncyl: 6,
  idleRpm: 700,
  redlineRpm: 8000,
  inertia: 0.94,
  noiseGain: 0.25
};
```

Then add the preset to the `<select>` element in `index.html`.

#### Customizing Audio Characteristics

Modify values in `SynthConstants` object in `engine-processor.js`:

```javascript
// Example: Adjust VTEC crossover point
VTEC_CROSSOVER_CENTER: 6000.0  // Default: 5600.0

// Example: Adjust harmonic count
HARMONIC_COUNT: 32  // Default: 24
```

#### Browser Requirements

- **Chrome/Edge**: 66+ (AudioWorklet support)
- **Firefox**: 76+ (AudioWorklet support)
- **Safari**: 14.1+ (AudioWorklet support)

### Future Improvements

- Tire grip/traction loss modeling
- Additional engine modes (rotary, diesel, electric motor simulation)
- Recording and playback functionality
- Visual spectrum analyzer
- Native mobile applications (iOS/Android)
- Progressive Web App (PWA) for offline use

### Project Documentation

For comprehensive project information, refer to:
- **[REQUIREMENTS.md](REQUIREMENTS.md)** - Complete requirements definition document
- **[AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md)** - Instructions for creating mobile version
- **[ENGINE_SOUND_ALGORITHM_JA.md](ENGINE_SOUND_ALGORITHM_JA.md)** - Detailed Japanese explanation of the engine sound generation algorithm
- **[.claude/context.md](.claude/context.md)** - Technical architecture and development guide

### Mobile Support

This application works on mobile browsers but is optimized for desktop use. For information about creating a fully mobile-optimized version:
- See [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) for complete mobile implementation guide
- Key mobile considerations:
  - Touch-optimized controls (minimum 48x48dp touch targets)
  - Performance optimization (reduced harmonics for mobile)
  - Progressive Web App (PWA) for installable experience
  - Battery optimization with Wake Lock API
  - Responsive layout for all screen sizes
  - Gesture support (swipe for gear shifting)

### Technologies

- Vanilla JavaScript (no frameworks)
- Web Audio API with AudioWorklet
- HTML5 and CSS3
- SVG for gauges and visualizations
- localStorage for settings persistence

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

### アーキテクチャ

アプリケーションはレイヤー化されたアーキテクチャに従っています：

```
┌────────────────────────────────────┐
│  index.html (プレゼンテーション層) │
│  UI コンポーネント、表示、コントロール │
└────────────────────────────────────┘
                ↓
┌────────────────────────────────────┐
│   app.js (アプリケーション層)       │
│   - CONFIG: 集約化された設定        │
│   - 物理エンジン (RPM, トルク)      │
│   - 車両動力学 (速度, 負荷)         │
│   - 入力処理                       │
│   - オーディオパラメータ同期         │
└────────────────────────────────────┘
                ↓
┌────────────────────────────────────┐
│ engine-processor.js (オーディオ層)  │
│ - SynthConstants: 音声合成パラメータ │
│ - ハーモニクス合成                  │
│ - マルチバンドノイズ生成             │
│ - 共鳴モデリング                    │
│ - エンジンモード実装                │
└────────────────────────────────────┘
```

**主要な設計原則:**
- **関心の分離**: UI、ロジック、音声合成が明確に分離されています
- **ハードコーディングより設定**: すべての調整可能なパラメータは CONFIG および SynthConstants オブジェクトに含まれています
- **リアルタイム合成**: 音声サンプルは使用せず、すべて手続き的に生成されます
- **モジュール構造**: 新しいエンジンプリセットや音響視点を追加しやすい設計

### 開発

#### コード構造

- `app.js`: すべてのアプリケーション設定を含む CONFIG オブジェクト（プリセット、視点、車両パラメータ、物理定数）
- `engine-processor.js`: すべての音声合成パラメータを含む SynthConstants オブジェクト
- `.claude/context.md`: Claude AI 支援のための包括的なドキュメント

#### 新しいエンジンプリセットの追加

`app.js` の `CONFIG.presets` オブジェクトを編集します：

```javascript
CONFIG.presets.myEngine = {
  ncyl: 6,
  idleRpm: 700,
  redlineRpm: 8000,
  inertia: 0.94,
  noiseGain: 0.25
};
```

次に、`index.html` の `<select>` 要素にプリセットを追加します。

#### オーディオ特性のカスタマイズ

`engine-processor.js` の `SynthConstants` オブジェクトの値を変更します：

```javascript
// 例: VTEC クロスオーバーポイントの調整
VTEC_CROSSOVER_CENTER: 6000.0  // デフォルト: 5600.0

// 例: ハーモニック数の調整
HARMONIC_COUNT: 32  // デフォルト: 24
```

#### ブラウザ要件

- **Chrome/Edge**: 66+ (AudioWorklet サポート)
- **Firefox**: 76+ (AudioWorklet サポート)
- **Safari**: 14.1+ (AudioWorklet サポート)

### 今後の改善アイデア

- タイヤグリップ・トラクションの表現強化
- 追加のエンジンモード（ロータリー、ディーゼル、電気モーターシミュレーション）
- 録音および再生機能
- ビジュアルスペクトラムアナライザー
- ネイティブモバイルアプリケーション（iOS/Android）
- オフライン使用のためのプログレッシブウェブアプリ（PWA）

### プロジェクトドキュメント

包括的なプロジェクト情報については、以下を参照してください：
- **[REQUIREMENTS.md](REQUIREMENTS.md)** - 完全な要件定義書
- **[AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md)** - モバイル版作成のための指示書
- **[ENGINE_SOUND_ALGORITHM_JA.md](ENGINE_SOUND_ALGORITHM_JA.md)** - エンジン音生成アルゴリズムの詳細な日本語解説
- **[.claude/context.md](.claude/context.md)** - 技術アーキテクチャと開発ガイド

### モバイルサポート

このアプリケーションはモバイルブラウザでも動作しますが、デスクトップ用に最適化されています。完全にモバイル最適化されたバージョンの作成については：
- 完全なモバイル実装ガイドは [AI_INSTRUCTIONS.md](AI_INSTRUCTIONS.md) を参照
- 主なモバイル対応項目：
  - タッチ最適化コントロール（最小48x48dpのタッチターゲット）
  - パフォーマンス最適化（モバイル用にハーモニクス数を削減）
  - インストール可能なエクスペリエンスのためのプログレッシブウェブアプリ（PWA）
  - Wake Lock APIによるバッテリー最適化
  - すべての画面サイズに対応するレスポンシブレイアウト
  - ジェスチャーサポート（ギアシフト用のスワイプ）

### 使用技術

- Vanilla JavaScript（フレームワーク不使用）
- Web Audio API（AudioWorklet使用）
- HTML5 & CSS3
- SVG によるゲージと可視化
- localStorage による設定の永続化
