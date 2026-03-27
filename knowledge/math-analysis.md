category: mathematics

## Real Analysis — Sequences and Limits
A sequence {a_n} in R converges to L if for every ε > 0, there exists N such that n > N implies |a_n - L| < ε. Monotone convergence theorem: every bounded monotone sequence converges. Bolzano-Weierstrass: every bounded sequence has a convergent subsequence. Cauchy criterion: {a_n} converges iff for every ε > 0, there exists N such that m,n > N implies |a_m - a_n| < ε. limsup and liminf: limsup a_n = lim(n->∞) sup{a_k : k ≥ n}. A sequence converges iff limsup = liminf.

## Real Analysis — Metric Spaces and Topology
A metric space (X,d) satisfies: d(x,y) ≥ 0, d(x,y) = 0 iff x = y, d(x,y) = d(y,x), triangle inequality. Open ball B(x,r) = {y : d(x,y) < r}. Open set: every point has an open ball contained in it. Closed set: complement of open set, equivalently contains all limit points. Compact: every open cover has a finite subcover. In R^n: compact iff closed and bounded (Heine-Borel). Sequential compactness: every sequence has a convergent subsequence (equivalent to compactness in metric spaces). Connected: cannot be written as union of two disjoint nonempty open sets.

## Real Analysis — Continuity and Differentiability
f: (X,d_X) -> (Y,d_Y) continuous at a if for every ε > 0, exists δ > 0 such that d_X(x,a) < δ implies d_Y(f(x),f(a)) < ε. Equivalent: preimage of every open set is open. Continuous image of compact set is compact. Continuous image of connected set is connected. Extreme value theorem: continuous f on compact set attains max and min. Uniform continuity: δ depends only on ε, not on the point. Continuous on compact set implies uniformly continuous. Differentiability implies continuity but not conversely.

## Real Analysis — Integration (Lebesgue)
Lebesgue measure: extends length to a σ-algebra of subsets of R. Measurable function: preimage of every open set is measurable. Simple function: finite linear combination of indicator functions. Lebesgue integral: first for simple functions, then for nonneg measurable (supremum of simple), then split f = f^+ - f^-. Monotone convergence theorem: if f_n ↑ f a.e., then ∫f_n → ∫f. Dominated convergence theorem: if f_n → f a.e. and |f_n| ≤ g with ∫g < ∞, then ∫f_n → ∫f. Fatou's lemma: ∫liminf f_n ≤ liminf ∫f_n. Fubini's theorem: ∫∫f dxdy = ∫∫f dydx when ∫|f| < ∞. L^p spaces: f in L^p if ∫|f|^p < ∞. Hölder's inequality: ∫|fg| ≤ ||f||_p ||g||_q where 1/p + 1/q = 1.

## Complex Analysis — Analytic Functions
f(z) = u(x,y) + iv(x,y) is analytic if it satisfies Cauchy-Riemann equations: ∂u/∂x = ∂v/∂y, ∂u/∂y = -∂v/∂x. Equivalent: f'(z) = lim(h->0) [f(z+h)-f(z)]/h exists (independent of direction). Analytic implies infinitely differentiable. Analytic implies has power series expansion. Liouville's theorem: bounded entire function is constant. Fundamental theorem of algebra follows. Harmonic functions: u, v satisfying ∇²u = 0 (Laplace's equation). Real/imaginary parts of analytic functions are harmonic conjugates.

## Complex Analysis — Contour Integration and Residues
Cauchy's integral theorem: if f analytic on simply connected domain, ∮_C f(z)dz = 0. Cauchy's integral formula: f(z_0) = (1/2πi)∮_C f(z)/(z-z_0) dz. Derivatives: f^(n)(z_0) = (n!/2πi)∮_C f(z)/(z-z_0)^{n+1} dz. Laurent series: f(z) = Σ_{n=-∞}^{∞} a_n(z-z_0)^n in annulus. Residue: Res(f, z_0) = a_{-1} (coefficient of 1/(z-z_0)). Residue theorem: ∮_C f(z)dz = 2πi Σ Res(f, z_k) for poles inside C. Simple pole: Res = lim(z->z_0) (z-z_0)f(z). Applications: evaluating real integrals (semicircular contours, keyhole contours), summing series.

## Complex Analysis — Conformal Mappings
Conformal map: analytic with f'(z) ≠ 0, preserves angles and orientation. Möbius transformations: f(z) = (az+b)/(cz+d), ad-bc ≠ 0, maps circles/lines to circles/lines. Riemann mapping theorem: any simply connected domain (not all of C) is conformally equivalent to the unit disk. Key mappings: z^2 doubles angles, e^z maps strips to sectors, log(z) maps sectors to strips, (z-1)/(z+1) maps right half-plane to unit disk. Schwarz-Christoffel formula maps upper half-plane to polygonal regions. Maximum modulus principle: |f| attains max on boundary of domain.
