# 构建压缩感知（Compressed Sensing, CS）算法代码

 - 内容来自Gemini 2.5 pro

构建压缩感知（Compressed Sensing, CS）算法代码通常涉及以下几个核心步骤。压缩感知理论指出，如果信号是稀疏的或可压缩的，那么就可以用远少于奈奎斯特采样定理所要求的采样点来精确地重建信号。

以下是构建压缩感知算法代码的一般步骤和关键组成部分：

**1. 定义稀疏信号 (Define the Sparse Signal):**

* **生成或获取原始信号 (Generate or Acquire the Original Signal):** 这可能是一个图像、音频信号、时间序列数据等。
* **稀疏表示 (Sparse Representation):** 原始信号本身可能不是稀疏的，但可以在某个变换域中变得稀疏。常见的变换包括：
    * **傅里叶变换 (Fourier Transform - FT):** 适用于频域稀疏的信号。
    * **离散余弦变换 (Discrete Cosine Transform - DCT):** 常用于图像和视频压缩。
    * **小波变换 (Wavelet Transform - WT):** 适用于具有局部特征的信号。
    * **自定义字典 (Custom Dictionary):** 对于特定类型的信号，可能会有更合适的稀疏基。
    * 在代码中，你需要实现或使用库函数来对原始信号进行这些变换，得到稀疏系数向量 $\alpha$。通常，只有少数几个 $\alpha_i$ 的值很大，而其余的接近于零。

**2. 构建测量矩阵 (Construct the Measurement Matrix):**

* 测量矩阵 $\Phi$ 是一个 $M \times N$ 的矩阵，其中 $N$ 是原始信号的维度（或稀疏表示的维度），$M$ 是测量次数 ($M < N$)。
* 测量矩阵需要满足某些特性，如**受限等距性质 (Restricted Isometry Property - RIP)**，以保证能够从压缩测量中恢复稀疏信号。在实践中，通常使用随机矩阵，因为它们很大概率满足 RIP。常见的选择有：
    * **高斯随机矩阵 (Gaussian Random Matrix):** 矩阵的每个元素从高斯分布中独立采样。
    * **伯努利随机矩阵 (Bernoulli Random Matrix):** 矩阵的每个元素从 $\{-1, +1\}$ 中等概率随机选择。
    * **部分傅里叶矩阵 (Partial Fourier Matrix):** 随机选择傅里叶变换矩阵的 $M$ 行。
    * **稀疏随机矩阵 (Sparse Random Matrix):** 包含大量零元素的随机矩阵，可以加速计算。
* 在代码中，你需要生成这样一个矩阵。例如，在 Python 中，可以使用 `numpy.random.randn` 生成高斯矩阵。

**3. 执行压缩感知测量 (Perform Compressed Sensing Measurement):**

* 压缩测量是通过将原始信号（或其稀疏表示）与测量矩阵相乘来获得的。
* 如果直接对原始信号 $x$（维度为 $N$）进行测量，则测量结果 $y = \Phi x$（维度为 $M$）。
* 如果信号 $x$ 在某个正交基 $\Psi$ 下是稀疏的，即 $x = \Psi \alpha$（其中 $\alpha$ 是稀疏系数），那么测量可以表示为 $y = \Phi \Psi \alpha = \Theta \alpha$，其中 $\Theta = \Phi \Psi$ 称为传感矩阵或恢复矩阵。
* 在代码中，这一步通常是一个简单的矩阵向量乘法。

**4. 实现重建算法 (Implement a Reconstruction Algorithm):**

* 这是压缩感知中最核心和最具挑战性的部分。目标是从压缩测量 $y$ 和已知的测量矩阵 $\Phi$（或 $\Theta$）中恢复稀疏信号 $\alpha$（或 $x$）。
* 这是一个欠定方程组，因为 $M < N$。重建算法利用信号的稀疏性来找到唯一的稀疏解。
* 常见的重建算法包括：
    * **L1 范数最小化 (L1-norm Minimization) / 基追踪 (Basis Pursuit - BP):**
        $$\min_{\alpha} \|\alpha\|_1 \quad \text{subject to} \quad y = \Theta \alpha$$
        这通常可以转化为线性规划问题。
    * **贪婪算法 (Greedy Algorithms):**
        * **匹配追踪 (Matching Pursuit - MP):** 迭代地选择与当前残差最相关的原子（$\Theta$ 的列）。
        * **正交匹配追踪 (Orthogonal Matching Pursuit - OMP):** MP 的改进版，在每一步都对已选原子进行正交化，以确保残差与已选原子正交。这是教学和基础实现中非常流行的一种算法。
        * **压缩采样匹配追踪 (Compressive Sampling Matching Pursuit - CoSaMP):** 每次迭代选择多个原子。
        * **迭代硬阈值 (Iterative Hard Thresholding - IHT):** 通过梯度下降和硬阈值操作交替进行。
    * **其他算法:** 如迭代软阈值算法 (Iterative Soft-Thresholding Algorithm - ISTA)、快速迭代软阈值算法 (Fast Iterative Soft-Thresholding Algorithm - FISTA)、最小全变差 (Total Variation - TV) 最小化（常用于图像），以及基于贝叶斯的方法等。

* **代码实现注意事项:**
    * **OMP 示例:**
        1.  初始化残差 $r_0 = y$，支撑集 $S_0 = \emptyset$，迭代次数 $k=0$。
        2.  迭代直到满足停止条件 (例如，迭代次数达到稀疏度 $K$，或残差足够小)：
            a.  找到与当前残差 $r_k$ 最相关的原子（$\Theta$ 的列）：$j_k = \arg\max_j |\langle r_k, \theta_j \rangle|$。
            b.  更新支撑集: $S_{k+1} = S_k \cup \{j_k\}$。
            c.  求解最小二乘问题以获得当前支撑集上的信号估计: $\alpha_{S_{k+1}} = (\Theta_{S_{k+1}}^\dagger) y$，其中 $\Theta_{S_{k+1}}$ 是由 $S_{k+1}$ 中的列组成的矩阵，$\dagger$ 表示伪逆。
            d.  更新残差: $r_{k+1} = y - \Theta_{S_{k+1}} \alpha_{S_{k+1}}$。
            e.  $k = k+1$。
        3.  最终的稀疏系数向量 $\hat{\alpha}$ 在 $S_k$ 上的分量为计算出的值，其余为零。
    * **L1 最小化:** 可以使用现有的凸优化库，如 Python 中的 `cvxpy` 或 MATLAB 中的 `CVX`。

**5. 信号恢复 (Signal Recovery):**

* 如果重建的是稀疏系数 $\hat{\alpha}$，并且原始信号是在某个变换域 $\Psi$ 下稀疏的，那么需要通过逆变换来恢复原始信号：$\hat{x} = \Psi \hat{\alpha}$。
* 如果直接重建的是信号 $\hat{x}$，则此步骤不是必需的。

**选择编程语言和库:**

* **Python:**
    * `NumPy`: 用于数值计算，特别是数组和矩阵操作。
    * `SciPy`: 包含傅里叶变换、小波变换、线性代数模块等。
    * `Scikit-learn`: 提供了一些稀疏编码和重建算法的实现 (例如 `OrthogonalMatchingPursuit`, `Lasso` 它对应于 L1 正则化的最小二乘，与基追踪相关)。
    * `PyWavelets`: 用于小波变换。
    * `CVXPY`: 用于凸优化问题建模，可以方便地实现 L1 最小化。
    * `Sporco`: 一个专门用于稀疏表示和压缩感知的 Python 库。
* **MATLAB:**
    * 内置了丰富的信号处理、图像处理和优化工具箱。
    * `fft`, `dct`, `dwt` (需要 Wavelet Toolbox) 等变换函数。
    * `\ ` (反斜杠运算符) 或 `pinv` 可以用于求解最小二乘问题。
    * `CVX`: 流行的凸优化建模工具。
    * 有一些研究者共享的压缩感知工具箱，如 `SPGL1`, `GPSR`, `OMPBox`。

**一个简化的 Python 伪代码示例 (使用 OMP):**

```python
import numpy as np
from scipy.fftpack import dct, idct # 以 DCT 为例
from sklearn.linear_model import OrthogonalMatchingPursuit

# 1. 定义/生成稀疏信号
N = 256  # 信号长度
K = 20   # 稀疏度 (非零元素个数)

# 生成一个在 DCT 域稀疏的信号
x_orig = np.zeros(N)
t = np.linspace(0, 1, N)
x_orig += np.sin(13 * 2 * np.pi * t)
x_orig += np.sin(37 * 2 * np.pi * t)
# 在实际中，信号可能更复杂，稀疏性可能不完美

# 找到其 DCT 变换 (alpha)
alpha = dct(x_orig, norm='ortho')
# (可选) 人为制造稀疏性以简化示例
# indices = np.random.choice(N, K, replace=False)
# alpha_sparse = np.zeros(N)
# alpha_sparse[indices] = alpha[indices] # 或者直接赋予一些值
# x_sparse_domain = idct(alpha_sparse, norm='ortho') # 这是理想的稀疏信号

# 2. 构建测量矩阵
M = 64  # 测量次数， M < N
Phi = np.random.randn(M, N)
# (可选) 对 Phi 进行正交化或归一化处理，但这不总是必需的

# 3. 执行压缩感知测量
# 假设我们直接测量原始信号 x，并且重建时考虑其在 DCT 域的稀疏性
# 那么传感矩阵 Theta = Phi * Psi_inv (这里 Psi_inv 是 IDCT 矩阵)
# 或者，如果我们知道信号在某个域是稀疏的，我们测量的是原始信号 x
y = np.dot(Phi, x_orig)

# 4. 实现重建算法 (使用 scikit-learn 的 OMP)
# OMP 试图找到 y = Phi @ x_reconstructed 中的 x_reconstructed
# 如果我们知道 x_reconstructed 在 DCT 域是稀疏的，
# 则令 x_reconstructed = IDCT(alpha_reconstructed)
# 那么 y = Phi @ IDCT(alpha_reconstructed)
# 我们可以定义 A = Phi @ IDCT_matrix，然后求解 y = A @ alpha_reconstructed
# 或者，一些 OMP 实现可以直接处理字典

# 更直接的方法：许多 CS 公式假设 y = Theta * alpha，其中 Theta = Phi * Psi
# Psi 是稀疏基矩阵 (例如 DCT 矩阵的列是基向量)
Psi = dct(np.eye(N), norm='ortho') # DCT 矩阵 (每一列是一个基向量)
Theta = np.dot(Phi, Psi.T) # Psi.T 因为我们用 alpha 做列向量 x = Psi.T @ alpha
                          # 或者 Psi 的每一行是一个基向量，x_transformed = Psi @ x_original
                          # 这里我们假设 x_orig = Psi_inv @ alpha, Psi_inv 是 IDCT
                          # 所以 alpha = Psi @ x_orig.
                          # y = Phi @ x_orig = Phi @ Psi_inv @ alpha
                          # 令 Theta = Phi @ Psi_inv
                          # Psi_inv 是 IDCT 矩阵，其列是 DCT 基函数。
                          # 更简单地，scikit-learn 的 OMP 可以配置为在变换域寻找解。

# 使用 scikit-learn OMP
omp = OrthogonalMatchingPursuit(n_nonzero_coefs=K) # 假设已知稀疏度 K

# 我们需要找到 alpha_reconstructed 使得 y ≈ Phi @ idct(alpha_reconstructed)
# 或者，如果重建 x, 且 x 在 Psi 域稀疏。
# sklearn 的 OMP 求解 y = D_omp @ coefs， 我们需要设定 D_omp 和要恢复的 coefs
# 如果我们要恢复 alpha，那么 D_omp = Phi @ Psi_inv。
# 如果我们要直接恢复 x，并且约束 x 在 Psi 域是稀疏的，则更复杂。

# 让我们尝试直接恢复 x，并期望恢复的 x 具有稀疏的 DCT 变换。
# 这不是 OMP 的标准用法，OMP 通常用于 y = D_omp @ sparse_coeffs
# 为了正确使用 OMP 来恢复 alpha:
# Theta = Phi @ idct_matrix (idct_matrix 的列是 DCT 基函数)
# idct_matrix = Psi.T (因为 Psi 的行是 DCT 基函数)
idct_matrix = idct(np.eye(N), norm='ortho').T # 列是 DCT 基向量
Theta_omp = np.dot(Phi, idct_matrix)

omp.fit(Theta_omp, y)
alpha_reconstructed = omp.coef_

# 5. 信号恢复
x_reconstructed = idct(alpha_reconstructed, norm='ortho')

# 评估重建效果
mse = np.mean((x_orig - x_reconstructed)**2)
print(f"Mean Squared Error: {mse}")

# 可以绘制原始信号和重建信号进行比较
import matplotlib.pyplot as plt
plt.figure(figsize=(10, 6))
plt.plot(t, x_orig, label='Original Signal')
plt.plot(t, x_reconstructed, '--', label='Reconstructed Signal')
plt.legend()
plt.show()

plt.figure(figsize=(10, 4))
plt.subplot(1,2,1)
plt.stem(alpha, use_line_collection=True, label='Original DCT Coefficients')
plt.title('Original DCT')
plt.subplot(1,2,2)
plt.stem(alpha_reconstructed, use_line_collection=True, label='Reconstructed DCT Coefficients')
plt.title('Reconstructed DCT (via OMP)')
plt.tight_layout()
plt.show()
```

**关键考虑因素:**

* **稀疏度 (Sparsity Level K):** 重建算法的性能通常依赖于信号的稀疏度。有些算法（如OMP）可能需要预先知道或估计稀疏度。
* **测量次数 (Number of Measurements M):** $M$ 需要大于某个理论下限，通常与 $K \log(N/K)$ 成正比。$M$ 太小会导致重建失败或精度不高。
* **测量矩阵的选择:** 随机矩阵在理论上很好，但在特定硬件或应用中，结构化随机矩阵（如部分循环矩阵、托普利兹矩阵）可能更高效。
* **计算复杂度:** 不同的重建算法具有不同的计算复杂度。贪婪算法通常比 L1 最小化快，但 L1 最小化在某些条件下有更强的恢复保证。
* **噪声鲁棒性:** 实际测量通常包含噪声 ($y = \Theta \alpha + e$)。重建算法需要能够处理噪声。L1 最小化可以修改为有噪声的版本（如 Lasso 或 Basis Pursuit DeNoising - BPDN）。

构建压缩感知代码是一个涉及理论理解和实践调整的过程。建议从简单的信号和算法（如一维信号、DCT稀疏性、OMP重建）开始，然后逐步扩展到更复杂的情况。查阅相关的研究论文和开源代码库也会非常有帮助。