category: mathematics

## First-Order ODEs
Separable: dy/dx = f(x)g(y), separate and integrate. Linear: dy/dx + P(x)y = Q(x), integrating factor μ = e^{∫P dx}, solution y = (1/μ)∫μQ dx. Exact: M dx + N dy = 0 is exact if ∂M/∂y = ∂N/∂x, find F where ∂F/∂x = M, ∂F/∂y = N. Bernoulli: dy/dx + P(x)y = Q(x)y^n, substitute v = y^{1-n}. Homogeneous: dy/dx = f(y/x), substitute v = y/x. Existence & uniqueness: if f and ∂f/∂y continuous near (x_0, y_0), then y' = f(x,y), y(x_0) = y_0 has unique local solution (Picard-Lindelöf theorem).

## Second-Order Linear ODEs
General form: y'' + p(x)y' + q(x)y = g(x). Homogeneous (g=0): solutions form 2D vector space. Wronskian W = y_1y_2' - y_1'y_2 ≠ 0 for linearly independent solutions. Constant coefficients y'' + by' + cy = 0: characteristic equation r^2 + br + c = 0. Two real roots: y = c_1e^{r_1x} + c_2e^{r_2x}. Repeated root: y = (c_1 + c_2x)e^{rx}. Complex roots α ± βi: y = e^{αx}(c_1cos(βx) + c_2sin(βx)). Nonhomogeneous: y = y_h + y_p. Undetermined coefficients: guess y_p based on g(x) form. Variation of parameters: y_p = u_1y_1 + u_2y_2 where u_1' = -y_2g/W, u_2' = y_1g/W.

## Laplace Transforms
L{f(t)} = F(s) = ∫[0,∞) e^{-st}f(t)dt. Key transforms: L{1} = 1/s, L{t^n} = n!/s^{n+1}, L{e^{at}} = 1/(s-a), L{sin(bt)} = b/(s^2+b^2), L{cos(bt)} = s/(s^2+b^2). Properties: L{f'} = sF(s) - f(0), L{f''} = s^2F(s) - sf(0) - f'(0). Shifting: L{e^{at}f(t)} = F(s-a). Convolution: L{f*g} = F(s)G(s) where (f*g)(t) = ∫[0,t] f(τ)g(t-τ)dτ. Step function: L{u(t-a)f(t-a)} = e^{-as}F(s). Solve ODEs: transform equation, solve for Y(s), inverse transform. Partial fraction decomposition for inverse transforms.

## Systems of Linear ODEs
x' = Ax where x is vector, A is constant matrix. Solution: x(t) = e^{At}x_0. If A = PDP^{-1} (diagonalizable): e^{At} = Pe^{Dt}P^{-1}. For each eigenvalue λ with eigenvector v: solution component c*e^{λt}v. Complex eigenvalues α ± βi give oscillatory solutions e^{αt}(cos(βt), sin(βt)). Phase portraits: node (both λ real, same sign), saddle (real, opposite sign), spiral (complex λ), center (pure imaginary). Stability: asymptotically stable if all Re(λ) < 0, stable if all Re(λ) ≤ 0, unstable if any Re(λ) > 0.

## Power Series Solutions
For y'' + P(x)y' + Q(x)y = 0, assume y = Σa_nx^n near ordinary point. Substitute, match coefficients, get recurrence relation. Radius of convergence: distance to nearest singular point. Regular singular points: use Frobenius method y = x^r Σa_nx^n. Indicial equation gives r values. Bessel's equation: x^2y'' + xy' + (x^2-n^2)y = 0, solutions J_n(x) and Y_n(x). Legendre's equation: (1-x^2)y'' - 2xy' + n(n+1)y = 0, solutions are Legendre polynomials P_n(x). Sturm-Liouville theory: eigenvalue problems with orthogonal eigenfunctions.

## Partial Differential Equations
Heat equation: u_t = k*u_xx. Wave equation: u_tt = c^2*u_xx. Laplace's equation: u_xx + u_yy = 0. Separation of variables: assume u(x,t) = X(x)T(t), substitute, separate into ODEs. Boundary conditions determine eigenvalues. Fourier series solution: u = Σ(coefficients * eigenfunctions). Heat equation with u(0,t)=u(L,t)=0: u = Σ B_n sin(nπx/L) e^{-k(nπ/L)^2 t}, B_n from initial condition. Wave equation: u = Σ[A_n cos(cnπt/L) + B_n sin(cnπt/L)] sin(nπx/L). Method of characteristics for first-order PDEs: u_t + c*u_x = 0 has solution u(x,t) = f(x-ct).

## Fourier Series and Transforms
Fourier series on [-L,L]: f(x) = a_0/2 + Σ[a_n cos(nπx/L) + b_n sin(nπx/L)]. Coefficients: a_n = (1/L)∫f(x)cos(nπx/L)dx, b_n = (1/L)∫f(x)sin(nπx/L)dx. Parseval's theorem: (1/L)∫|f|^2 dx = |a_0|^2/2 + Σ(|a_n|^2 + |b_n|^2). Fourier transform: F(ω) = ∫f(x)e^{-iωx}dx. Inverse: f(x) = (1/2π)∫F(ω)e^{iωx}dω. Properties: F{f'} = iωF{f}, F{f*g} = F{f}F{g}. Plancherel: ∫|f|^2 dx = (1/2π)∫|F|^2 dω. Applications: solving PDEs, signal processing, spectral analysis.
