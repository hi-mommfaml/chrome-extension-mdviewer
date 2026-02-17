# KaTeXとMermaid.js テスト

## 数式テスト (KaTeX)

### インライン数式

アインシュタインの有名な式: $E = mc^2$

円周率: $\pi \approx 3.14159$

### ブロック数式

ガウス積分:

$$
\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}
$$

二次方程式の解の公式:

$$
x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}
$$

オイラーの等式:

$$
e^{i\pi} + 1 = 0
$$

---

## 図表テスト (Mermaid)

### フローチャート

```mermaid
graph TD
    A[開始] --> B{条件分岐}
    B -->|Yes| C[処理1]
    B -->|No| D[処理2]
    C --> E[終了]
    D --> E
```

### シーケンス図

```mermaid
sequenceDiagram
    participant ユーザー
    participant ブラウザ
    participant サーバー
    
    ユーザー->>ブラウザ: URLを入力
    ブラウザ->>サーバー: HTTPリクエスト
    サーバー->>ブラウザ: HTMLレスポンス
    ブラウザ->>ユーザー: ページを表示
```

### ガントチャート

```mermaid
gantt
    title プロジェクトスケジュール
    dateFormat  YYYY-MM-DD
    section 設計
    要件定義           :a1, 2024-01-01, 7d
    基本設計           :a2, after a1, 10d
    section 開発
    実装               :a3, after a2, 20d
    テスト             :a4, after a3, 10d
```

---

## 組み合わせテスト

数式とコードブロックの混在:

Pythonで数式を計算:

```python
import math

# 円の面積を計算
radius = 5
area = math.pi * radius ** 2
print(f"半径{radius}の円の面積: {area}")
```

円の面積の公式: $A = \pi r^2$

---

## 複雑な数式

行列:

$$
\begin{pmatrix}
a & b \\
c & d
\end{pmatrix}
\begin{pmatrix}
x \\
y
\end{pmatrix}
=
\begin{pmatrix}
ax + by \\
cx + dy
\end{pmatrix}
$$

総和記号:

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
