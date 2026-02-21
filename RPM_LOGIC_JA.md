# RPM ロジック 詳細解説

このドキュメントは、Engine Simulator における RPM（Revolutions Per Minute：回転数）の物理シミュレーションロジックを日本語で詳細に説明するものです。

---

## 目次

1. [概要](#1-概要)
2. [RPM の基本概念](#2-rpm-の基本概念)
3. [RPM 計算の全体フロー](#3-rpm-計算の全体フロー)
4. [目標 RPM の計算](#4-目標-rpm-の計算)
   - [スロットルベース目標 RPM](#41-スロットルベース目標-rpm)
   - [内部抵抗による補正](#42-内部抵抗による補正)
5. [慣性モデル](#5-慣性モデル)
   - [基本慣性](#51-基本慣性)
   - [負荷による慣性補正](#52-負荷による慣性補正)
6. [ギアチェンジ時の RPM 調整](#6-ギアチェンジ時の-rpm-調整)
7. [実車モードでの RPM 計算](#7-実車モードでの-rpm-計算)
8. [車速と RPM の関係](#8-車速と-rpm-の関係)
9. [パラメータ一覧](#9-パラメータ一覧)
10. [処理フロー図](#10-処理フロー図)
11. [実装例](#11-実装例)

---

## 1. 概要

Engine Simulator の RPM シミュレーションは、実際のエンジンの物理挙動を模倣するように設計されています。以下の要素を考慮した高度な物理モデルを採用しています：

- **スロットル入力**：ドライバーのアクセル操作
- **エンジン慣性**：回転体（クランクシャフト、フライホイール）の慣性モーメント
- **内部抵抗**：ポンピングロスや機械的摩擦
- **車両負荷**：空気抵抗、転がり抵抗、勾配抵抗
- **ギア比**：トランスミッションによる速度・トルク変換
- **実車センサー**：GPS と加速度センサーからの実データ（実車モード）

このシミュレーションは `app.js` の `update()` 関数内で毎フレーム（通常 60 Hz）実行されます。

---

## 2. RPM の基本概念

### RPM とは

RPM（Revolutions Per Minute）は、エンジンのクランクシャフトが 1 分間に何回転するかを示す単位です。

```
RPM = (回転数 / 分)
```

### アイドル RPM とレッドライン RPM

| 項目 | 説明 | 典型的な値 |
|---|---|---|
| **アイドル RPM** | エンジンがアクセルなしで安定して回転する最低回転数 | 700〜1,000 rpm |
| **レッドライン RPM** | エンジンの安全上限回転数（これ以上は燃料カット） | 6,000〜9,000 rpm |

### RPM の物理的意味

- **低 RPM**（アイドル〜3,000 rpm）：トルク重視、燃費良好、静か
- **中 RPM**（3,000〜6,000 rpm）：最大トルク帯、加速力が最大
- **高 RPM**（6,000〜レッドライン）：最大出力帯、音が激しくなる

---

## 3. RPM 計算の全体フロー

RPM は以下の 3 ステップで毎フレーム更新されます：

```
1. 目標 RPM の計算
   ↓
2. 慣性モデルの適用
   ↓
3. RPM の範囲制限
```

**コード上の位置：** `app.js:883-921`

---

## 4. 目標 RPM の計算

### 4-1. スロットルベース目標 RPM

スロットル（アクセル開度）が増えると、エンジンはより高い回転数を目指します。

```javascript
const freeTargetRpm = params.idleRpm + (params.redlineRpm - params.idleRpm) * params.currentThrottle;
```

**数式：**

```
freeTargetRpm = idleRpm + (redlineRpm - idleRpm) × throttle
```

| スロットル (throttle) | 目標 RPM |
|---|---|
| 0.0（アクセルオフ） | idleRpm（例：900 rpm） |
| 0.5（半開） | (idleRpm + redlineRpm) / 2（例：3,950 rpm） |
| 1.0（全開） | redlineRpm（例：7,000 rpm） |

**例：**

```
idleRpm = 900 rpm
redlineRpm = 7,000 rpm
throttle = 0.7

freeTargetRpm = 900 + (7,000 - 900) × 0.7
              = 900 + 4,270
              = 5,170 rpm
```

### 4-2. 内部抵抗による補正

実際のエンジンには、高回転時に以下の抵抗が増加します：

- **ポンピングロス**：ピストンが吸気・排気を行う際の抵抗
- **機械的摩擦**：ベアリング、ピストンリング、バルブトレインの摩擦

このシミュレーターでは、RPM の 1.5 乗に比例する抵抗をモデル化しています。

```javascript
const rpmNormalized = params.currentRpm / params.redlineRpm;
const internalResistance = Math.pow(rpmNormalized, 1.5);
const resistanceFactor = 0.15 * internalResistance;

const resistedTargetRpm = freeTargetRpm * (1.0 - resistanceFactor * (1.0 - params.currentThrottle));
const targetRpm = Math.max(params.idleRpm, resistedTargetRpm);
```

**数式：**

```
rpmNorm = currentRpm / redlineRpm           // 0〜1 に正規化
internalResistance = rpmNorm^1.5            // 非線形抵抗（高回転ほど大）
resistanceFactor = 0.15 × internalResistance  // スケール係数

resistedTargetRpm = freeTargetRpm × (1 - resistanceFactor × (1 - throttle))
targetRpm = max(idleRpm, resistedTargetRpm)
```

**特性：**

| 条件 | 効果 |
|---|---|
| スロットル全開（throttle = 1.0） | 抵抗補正なし（`resistanceFactor × 0 = 0`） |
| スロットル全閉（throttle = 0.0） | 最大 15% の抵抗（高回転時） |
| 低 RPM | 抵抗は小さい（`rpmNorm^1.5` が小さい） |
| 高 RPM | 抵抗が急増（`rpmNorm^1.5` が大きい） |

**例：**

```
現在 RPM = 6,000 rpm
レッドライン = 7,000 rpm
スロットル = 0.0（アクセル全閉）

rpmNorm = 6,000 / 7,000 = 0.857
internalResistance = 0.857^1.5 ≈ 0.794
resistanceFactor = 0.15 × 0.794 ≈ 0.119

freeTargetRpm = 900 rpm（アイドル）
resistedTargetRpm = 900 × (1 - 0.119 × 1) = 900 × 0.881 ≈ 793 rpm

→ アイドル以下には下がらないので targetRpm = 900 rpm
```

この補正により、高回転・低スロットル時に RPM がより急速に低下し、実際のエンジンの挙動に近づきます。

**コード上の位置：** `app.js:877-887`

---

## 5. 慣性モデル

### 5-1. 基本慣性

エンジンの回転体（クランクシャフト、フライホイール、ピストンなど）は慣性を持っており、RPM は瞬時には変化しません。慣性パラメータ（`inertia`）で応答速度を制御します。

```javascript
params.currentRpm = params.currentRpm * effectiveInertia + targetRpm * (1.0 - effectiveInertia);
```

**数式：**

```
currentRpm_new = currentRpm_old × inertia + targetRpm × (1 - inertia)
```

これは **指数移動平均（Exponential Moving Average）** と同じ形式です。

| 慣性値 (inertia) | 効果 | エンジン特性 |
|---|---|---|
| 0.80 | RPM が急速に変化 | 軽量エンジン、高応答（例：バイク、VTEC） |
| 0.95 | RPM が緩やかに変化 | 重量級エンジン、低応答（例：ターボ、大排気量） |
| 0.99 | RPM がほとんど変化しない | 超重量級（例：トラック、船舶エンジン） |

**例：**

```
現在 RPM = 3,000 rpm
目標 RPM = 5,000 rpm
慣性 = 0.95

新しい RPM = 3,000 × 0.95 + 5,000 × 0.05
           = 2,850 + 250
           = 3,100 rpm（1フレームでの変化：+100 rpm）

次のフレーム:
新しい RPM = 3,100 × 0.95 + 5,000 × 0.05
           = 2,945 + 250
           = 3,195 rpm（+95 rpm）
```

慣性が高いほど、目標 RPM に達するまでに時間がかかります。

### 5-2. 負荷による慣性補正

実際の車両では、エンジン負荷（坂道、空気抵抗、加速抵抗）が大きいほど RPM の応答が鈍くなります。また、減速時にはフライホイールの慣性により RPM が落ちにくくなります。

#### 5-2-1. 加速時の慣性補正

```javascript
if (targetRpm > params.currentRpm) {
  const loadResistance = Math.min(0.9, params.load * 0.7);
  effectiveInertia = params.inertia + (1.0 - params.inertia) * loadResistance;
}
```

**数式：**

```
loadResistance = min(0.9, load × 0.7)
effectiveInertia = inertia + (1 - inertia) × loadResistance
```

| 負荷 (load) | loadResistance | 効果 |
|---|---|---|
| 0.0（無負荷） | 0.0 | 慣性補正なし |
| 0.5（中負荷） | 0.35 | 慣性が 35% 増加 |
| 1.0（全負荷） | 0.7 | 慣性が 70% 増加 |

**例：**

```
inertia = 0.92
load = 0.8（坂道を登っている）

loadResistance = 0.8 × 0.7 = 0.56
effectiveInertia = 0.92 + (1 - 0.92) × 0.56
                 = 0.92 + 0.08 × 0.56
                 = 0.92 + 0.045
                 = 0.965

→ 通常より慣性が高くなり、RPM の上昇が遅くなる
```

#### 5-2-2. 減速時の慣性補正

```javascript
else {
  const engineBraking = isCoupled ? params.load * 0.3 : 0;
  effectiveInertia = params.inertia + (1.0 - params.inertia) * (1.0 - engineBraking) * 0.5;
}
```

**数式：**

```
engineBraking = (ギアが入っている場合) load × 0.3 : 0
effectiveInertia = inertia + (1 - inertia) × (1 - engineBraking) × 0.5
```

| 条件 | engineBraking | 効果 |
|---|---|---|
| ニュートラル（ギアなし） | 0.0 | 慣性が最大 50% 増加（RPM が落ちにくい） |
| ギア入り・無負荷 | 0.0 | 同上 |
| ギア入り・全負荷 | 0.3 | 慣性増加が 35% に低減（エンジンブレーキ効果） |

**例：**

```
inertia = 0.92
load = 0.5（ギア入り）

engineBraking = 0.5 × 0.3 = 0.15
effectiveInertia = 0.92 + (1 - 0.92) × (1 - 0.15) × 0.5
                 = 0.92 + 0.08 × 0.85 × 0.5
                 = 0.92 + 0.034
                 = 0.954

→ 減速時に慣性がやや増加し、RPM が落ちにくくなる
```

**コード上の位置：** `app.js:909-921`

---

## 6. ギアチェンジ時の RPM 調整

実際の車両では、ギアを変更すると車速を維持するために RPM が即座に変化します。

- **アップシフト**（1速 → 2速）：RPM が下がる
- **ダウンシフト**（3速 → 2速）：RPM が上がる

### 6-1. ギア比と総減速比

```javascript
function getOverallRatio() {
  if (vehicleState.gear <= 0) return 0;  // ニュートラル
  const gear = vehicleState.gearRatios[vehicleState.gear - 1] || 0;
  return gear * vehicleState.finalDrive;
}
```

**総減速比の計算：**

```
overallRatio = gearRatio × finalDrive
```

**デフォルトギア比（6速トランスミッション）：**

| ギア | ギア比 | ファイナル | 総減速比 |
|---|---|---|---|
| 1速 | 3.62 | 3.42 | 12.38 |
| 2速 | 2.19 | 3.42 | 7.49 |
| 3速 | 1.62 | 3.42 | 5.54 |
| 4速 | 1.27 | 3.42 | 4.34 |
| 5速 | 1.03 | 3.42 | 3.52 |
| 6速 | 0.82 | 3.42 | 2.80 |
| N（ニュートラル） | - | - | 0 |

### 6-2. ギアチェンジ時の RPM 調整

```javascript
function adjustRpmForGearChange() {
  if (!isPlaying || vehicleState.speed < 0.1) return;

  const newOverallRatio = getOverallRatio();
  if (newOverallRatio === 0) return;  // ニュートラル

  const newRpm = (vehicleState.speed * newOverallRatio * 60) / (2 * Math.PI * vehicleState.wheelRadius);

  params.currentRpm = Math.max(params.idleRpm * 0.75, Math.min(newRpm, params.redlineRpm * 1.05));
}
```

**数式：**

```
newRpm = (speed × overallRatio × 60) / (2π × wheelRadius)
```

**例：**

```
車速 = 50 km/h = 13.89 m/s
ホイール半径 = 0.33 m
現在 3速（総減速比 = 5.54）
現在 RPM = 4,000 rpm

4速にシフト（総減速比 = 4.34）:

newRpm = (13.89 × 4.34 × 60) / (2π × 0.33)
       = 3,620.76 / 2.073
       ≈ 3,132 rpm

→ RPM が 4,000 rpm から 3,132 rpm に即座に低下
```

**コード上の位置：** `app.js:811-826, 713-716`

---

## 7. 実車モードでの RPM 計算

実車モード（Real Vehicle Mode）では、GPS 速度センサーから取得した実際の車速に基づいて RPM を計算します。

### 7-1. GPS 速度の補間

GPS の更新頻度は通常 1 Hz（1 秒に 1 回）と低いため、線形補間とローパスフィルタで滑らかにします。

```javascript
// 線形補間
const now = Date.now();
const timeSinceUpdate = now - sensorState.lastGPSTime;
const interval = Math.max(100, sensorState.gpsInterval);  // 最小 100 ms
const t = sensorState.lastGPSTime > 0 ? Math.min(1.0, timeSinceUpdate / interval) : 1.0;
const targetSpeed = sensorState.prevGpsSpeed + (sensorState.gpsSpeed - sensorState.prevGpsSpeed) * t;

// 指数移動平均によるさらなる平滑化
const smoothFactor = 0.12;
sensorState.interpolatedSpeed += (targetSpeed - sensorState.interpolatedSpeed) * smoothFactor;
sensorState.interpolatedSpeed = Math.max(0, sensorState.interpolatedSpeed);
```

**補間の仕組み：**

```
t = 経過時間 / GPS更新間隔   // 0〜1

targetSpeed = prevSpeed + (newSpeed - prevSpeed) × t

interpolatedSpeed += (targetSpeed - interpolatedSpeed) × 0.12
```

**例：**

```
前回 GPS 速度 = 10 m/s
新 GPS 速度 = 15 m/s
GPS 更新間隔 = 1000 ms

500 ms 経過時（t = 0.5）:
targetSpeed = 10 + (15 - 10) × 0.5 = 12.5 m/s

さらに平滑化:
interpolatedSpeed = 現在値 × 0.88 + 12.5 × 0.12
```

### 7-2. 速度から RPM への変換

```javascript
const overallRatio1st = vehicleState.gearRatios[0] * vehicleState.finalDrive;
const rpmFromSpeed = (sensorState.interpolatedSpeed * overallRatio1st * 60) / (2 * Math.PI * vehicleState.wheelRadius);
params.currentRpm = Math.max(params.idleRpm, Math.min(rpmFromSpeed, params.redlineRpm * 1.05));
```

**数式：**

```
overallRatio1st = gearRatios[0] × finalDrive
                = 3.62 × 3.42
                = 12.38

rpmFromSpeed = (speed × overallRatio1st × 60) / (2π × wheelRadius)

currentRpm = clamp(rpmFromSpeed, idleRpm, redlineRpm × 1.05)
```

実車モードでは常に 1 速固定で計算されます。

**例：**

```
GPS 速度 = 30 km/h = 8.33 m/s
1速総減速比 = 12.38
ホイール半径 = 0.33 m

rpmFromSpeed = (8.33 × 12.38 × 60) / (2π × 0.33)
             = 6,186.3 / 2.073
             ≈ 2,985 rpm
```

**コード上の位置：** `app.js:923-946`

---

## 8. 車速と RPM の関係

車速は RPM とギア比から逆算されます。

```javascript
vehicleState.speed = isCoupled
  ? (params.currentRpm * 2 * Math.PI * vehicleState.wheelRadius) / (overallRatio * 60)
  : 0;
```

**数式：**

```
speed = (rpm × 2π × wheelRadius) / (overallRatio × 60)
```

**導出：**

```
ホイールの回転数（rev/min） = rpm / overallRatio
ホイールの回転数（rev/s）   = rpm / (overallRatio × 60)
ホイールの円周速度（m/s）   = (rpm / (overallRatio × 60)) × (2π × wheelRadius)
```

**各ギアでの速度例：**

RPM = 6,000 rpm、ホイール半径 = 0.33 m の場合：

| ギア | 総減速比 | 車速 (km/h) |
|---|---|---|
| 1速 | 12.38 | 50 |
| 2速 | 7.49 | 83 |
| 3速 | 5.54 | 112 |
| 4速 | 4.34 | 143 |
| 5速 | 3.52 | 176 |
| 6速 | 2.80 | 221 |

**計算例（3速）：**

```
speed = (6,000 × 2π × 0.33) / (5.54 × 60)
      = 12,441.5 / 332.4
      ≈ 37.4 m/s
      ≈ 135 km/h
```

**コード上の位置：** `app.js:948-951`

---

## 9. パラメータ一覧

### RPM 関連パラメータ

| パラメータ | 型 | 範囲 | デフォルト | 説明 |
|---|---|---|---|---|
| `currentRpm` | number | 0〜12,600 | 1,000 | 現在のエンジン回転数 |
| `idleRpm` | number | 500〜2,000 | 900 | アイドル回転数 |
| `redlineRpm` | number | 3,000〜12,000 | 7,000 | レッドライン回転数 |
| `inertia` | number | 0.8〜0.99 | 0.95 | エンジン慣性（高いほど応答が遅い） |
| `currentThrottle` | number | 0〜1 | 0.0 | 現在のスロットル開度 |
| `targetThrottle` | number | 0〜1 | 0.0 | 目標スロットル開度 |
| `load` | number | 0〜1 | 0.0 | エンジン負荷（トルク要求 / 最大トルク） |

### 車両パラメータ

| パラメータ | 値 | 説明 |
|---|---|---|
| `wheelRadius` | 0.33 m | タイヤ半径（255/40R18 相当） |
| `gearRatios` | [3.62, 2.19, 1.62, 1.27, 1.03, 0.82] | 6速トランスミッションギア比 |
| `finalDrive` | 3.42 | ファイナルドライブ（デフ）ギア比 |
| `mass` | 1,350 kg | 車両質量 |
| `dragCoef` | 0.30 | 空気抵抗係数 |
| `frontalArea` | 2.1 m² | 前面投影面積 |

### エンジンプリセット慣性値

| プリセット | 慣性 | 特性 |
|---|---|---|
| NA | 0.92 | 高応答（軽量） |
| VTEC | 0.90 | 最高応答（超軽量） |
| Turbo | 0.97 | 低応答（ターボラグ） |
| FA24 Boxer | 0.96 | 低応答（水平対向の慣性） |
| V8 | 0.97 | 低応答（大排気量） |
| Rotary | 0.88 | 超高応答（ロータリー） |

---

## 10. 処理フロー図

```
ユーザー入力（スロットル）
         │
         ▼
┌─────────────────────────────────┐
│ スロットル補間                   │
│ currentThrottle += (target - current) × response │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 目標 RPM 計算                   │
│ freeTargetRpm = idle + (red - idle) × throttle │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 内部抵抗補正                    │
│ internalRes = (rpm/redline)^1.5 │
│ resistedTarget = free × (1 - 0.15×res×(1-thr)) │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 負荷計算                        │
│ load = 抵抗負荷 + 慣性負荷        │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 実効慣性計算                    │
│ 加速時: + load補正               │
│ 減速時: + フライホイール慣性      │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ RPM 更新（慣性モデル）           │
│ rpm_new = rpm × inertia + target × (1-inertia) │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ RPM 範囲制限                    │
│ rpm = clamp(rpm, idle×0.75, red×1.05) │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 実車モード補正（有効時）         │
│ rpm = f(GPS速度, ギア比)         │
└─────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│ 車速計算                        │
│ speed = (rpm × 2πr) / (ratio × 60) │
└─────────────────────────────────┘
         │
         ▼
    UI 表示 & 音声合成
```

---

## 11. 実装例

### 例 1: アクセル全開での加速（3速、平地）

```
初期状態:
  RPM = 3,000 rpm
  スロットル = 0.0
  ギア = 3速
  車速 = 50 km/h
  負荷 = 0.05

ユーザーがアクセル全開:
  targetThrottle = 1.0

フレーム 1:
  currentThrottle = 0 + (1.0 - 0) × 0.1 = 0.1
  freeTargetRpm = 900 + (7,000 - 900) × 0.1 = 1,510 rpm
  internalResistance = (3,000/7,000)^1.5 ≈ 0.277
  resistanceFactor = 0.15 × 0.277 = 0.042
  resistedTargetRpm = 1,510 × (1 - 0.042 × 0.9) = 1,452 rpm
  → targetRpm = max(900, 1,452) = 1,452 rpm

  load = 0.4（加速中）
  loadResistance = 0.4 × 0.7 = 0.28
  effectiveInertia = 0.95 + 0.05 × 0.28 = 0.964

  currentRpm = 3,000 × 0.964 + 1,452 × 0.036 = 2,892 + 52 = 2,944 rpm

フレーム 2:
  currentThrottle = 0.1 + (1.0 - 0.1) × 0.1 = 0.19
  freeTargetRpm = 900 + 6,100 × 0.19 = 2,059 rpm
  ...
  （徐々に RPM が上昇）

フレーム 100:
  currentThrottle ≈ 1.0
  freeTargetRpm = 7,000 rpm
  currentRpm ≈ 6,800 rpm（レッドライン付近）
```

### 例 2: シフトアップ（3速 → 4速、6,000 rpm）

```
シフトアップ前（3速）:
  RPM = 6,000 rpm
  速度 = 112 km/h = 31.1 m/s
  総減速比 = 5.54

シフトアップ実行（4速）:
  新総減速比 = 4.34

  newRpm = (31.1 × 4.34 × 60) / (2π × 0.33)
         = 8,101 / 2.073
         ≈ 4,700 rpm

  currentRpm = 4,700 rpm（即座に変化）

→ RPM が 6,000 → 4,700 に低下（-1,300 rpm）
```

### 例 3: 実車モード（GPS 速度 40 km/h）

```
実車モード有効:
  GPS速度 = 40 km/h = 11.11 m/s
  ギア = 1速（固定）
  総減速比 = 12.38

  rpmFromSpeed = (11.11 × 12.38 × 60) / (2π × 0.33)
               = 8,254 / 2.073
               ≈ 3,983 rpm

  currentRpm = 3,983 rpm
```

---

## 関連ドキュメント

- **[readme.md](readme.md)** - プロジェクト概要（日英バイリンガル）
- **[ENGINE_SOUND_ALGORITHM_JA.md](ENGINE_SOUND_ALGORITHM_JA.md)** - エンジン音生成アルゴリズム詳細解説
- **[REQUIREMENTS.md](REQUIREMENTS.md)** - 完全な要件定義書
- **[app.js](app.js)** - RPM ロジック実装（`update()` 関数、843-1018 行目）

---

**作成日：** 2026年2月21日
**バージョン：** 1.0
**対象ファイル：** `app.js`（RPM 計算ロジック）
