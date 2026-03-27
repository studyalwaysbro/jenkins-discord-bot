category: mathematics

## Vectors and Vector Spaces
A vector space V over field F satisfies: closure under addition and scalar multiplication, associativity, commutativity, additive identity (zero vector), additive inverses, distributivity, scalar multiplication identity. Subspace: nonempty subset closed under addition and scalar multiplication. Examples: R^n, polynomial spaces P_n, function spaces C[a,b], matrix spaces M_{m×n}. Span: set of all linear combinations. Linear independence: c_1v_1 + ... + c_nv_n = 0 implies all c_i = 0. Basis: linearly independent spanning set. Dimension: number of vectors in any basis.

## Matrices and Linear Transformations
A linear transformation T: V -> W satisfies T(au + bv) = aT(u) + bT(v). Every linear transformation from R^n to R^m is multiplication by an m×n matrix. Matrix operations: addition, scalar multiplication, multiplication (AB)_{ij} = Σ_k A_{ik}B_{kj}. AB ≠ BA in general. Transpose: (A^T)_{ij} = A_{ji}. Inverse: AA^{-1} = I, exists iff det(A) ≠ 0. Rank: dimension of column space = dimension of row space. Rank-nullity theorem: rank(A) + nullity(A) = n (number of columns). Row reduction/Gaussian elimination to echelon form.

## Determinants
det(A) computed by cofactor expansion or row reduction. Properties: det(AB) = det(A)det(B), det(A^T) = det(A), det(cA) = c^n det(A) for n×n. Row swap changes sign. Row of zeros means det = 0. det(A) ≠ 0 iff A invertible. Cramer's rule: x_i = det(A_i)/det(A). Geometric meaning: |det(A)| = volume scaling factor of the linear transformation. For 2×2: det = ad - bc. For 3×3: Sarrus' rule or cofactor expansion.

## Eigenvalues and Eigenvectors
Av = λv where λ is eigenvalue, v is eigenvector. Find eigenvalues: solve det(A - λI) = 0 (characteristic polynomial). Find eigenvectors: solve (A - λI)v = 0. Algebraic multiplicity: multiplicity of λ as root. Geometric multiplicity: dim(null(A - λI)). Diagonalization: A = PDP^{-1} where D is diagonal of eigenvalues, P columns are eigenvectors. A is diagonalizable iff geometric = algebraic multiplicity for all eigenvalues. Trace = sum of eigenvalues. Determinant = product of eigenvalues. Cayley-Hamilton: A satisfies its own characteristic polynomial.

## Inner Product Spaces and Orthogonality
Inner product on R^n: <u,v> = u·v = Σu_iv_i. Norm: ||v|| = sqrt(<v,v>). Cauchy-Schwarz: |<u,v>| ≤ ||u|| ||v||. Triangle inequality: ||u+v|| ≤ ||u|| + ||v||. Orthogonal: <u,v> = 0. Gram-Schmidt process: orthogonalize a basis. QR decomposition: A = QR where Q orthogonal, R upper triangular. Orthogonal projection: proj_W(v) = Σ(<v,u_i>/<u_i,u_i>)u_i for orthogonal basis. Least squares: minimize ||Ax - b||^2, solve A^TAx = A^Tb. Normal equations.

## Singular Value Decomposition (SVD)
A = UΣV^T where U (m×m orthogonal), Σ (m×n diagonal of singular values), V (n×n orthogonal). Singular values σ_i = sqrt(eigenvalues of A^TA), always ≥ 0. Columns of V: eigenvectors of A^TA. Columns of U: eigenvectors of AA^T. Applications: pseudoinverse A^+ = VΣ^+U^T, low-rank approximation (Eckart-Young: best rank-k approximation is truncated SVD), PCA, image compression. Condition number: σ_max/σ_min. rank(A) = number of nonzero singular values.

## Jordan Normal Form
Every square matrix over C is similar to a Jordan form: block diagonal with Jordan blocks J_k(λ) = λI + N where N is the superdiagonal of 1s. Each Jordan block corresponds to a chain of generalized eigenvectors. A is diagonalizable iff all Jordan blocks are 1×1. Matrix exponential: e^{tA} = Pe^{tJ}P^{-1}. For a Jordan block: e^{tJ_k(λ)} = e^{λt} times a matrix involving t^j/j! terms. Used in solving systems of linear ODEs.
