category: mathematics

## Limits and Continuity
A limit describes the value a function approaches as the input approaches a point. Formal (epsilon-delta) definition: For every epsilon > 0, there exists delta > 0 such that if 0 < |x - a| < delta, then |f(x) - L| < epsilon. Key limit laws: sum, product, quotient, squeeze theorem. L'Hopital's Rule: If lim f(x)/g(x) gives 0/0 or inf/inf, then lim f(x)/g(x) = lim f'(x)/g'(x). One-sided limits, limits at infinity. A function is continuous at a if lim(x->a) f(x) = f(a). Intermediate Value Theorem: If f is continuous on [a,b] and k is between f(a) and f(b), then there exists c in (a,b) with f(c) = k.

## Derivatives and Differentiation Rules
The derivative f'(x) = lim(h->0) [f(x+h) - f(x)] / h measures instantaneous rate of change. Power rule: d/dx[x^n] = nx^(n-1). Product rule: (fg)' = f'g + fg'. Quotient rule: (f/g)' = (f'g - fg')/g^2. Chain rule: d/dx[f(g(x))] = f'(g(x)) * g'(x). Implicit differentiation: differentiate both sides with respect to x, solve for dy/dx. Logarithmic differentiation for products/quotients. Higher-order derivatives. Related rates: differentiate an equation relating quantities with respect to time. Mean Value Theorem: If f continuous on [a,b] and differentiable on (a,b), there exists c with f'(c) = [f(b)-f(a)]/(b-a).

## Applications of Derivatives
Critical points where f'(x) = 0 or undefined. First derivative test: sign changes of f' determine local max/min. Second derivative test: f''(c) > 0 means local min, f''(c) < 0 means local max. Concavity: f'' > 0 concave up, f'' < 0 concave down. Inflection points where concavity changes. Optimization: find absolute max/min on closed interval by checking critical points and endpoints. Linear approximation: f(x) ≈ f(a) + f'(a)(x-a). Newton's method: x_{n+1} = x_n - f(x_n)/f'(x_n).

## Integration
The definite integral ∫[a,b] f(x)dx represents signed area under the curve. Fundamental Theorem of Calculus Part 1: d/dx[∫[a,x] f(t)dt] = f(x). Part 2: ∫[a,b] f(x)dx = F(b) - F(a) where F' = f. Basic antiderivatives: ∫x^n dx = x^(n+1)/(n+1) + C (n≠-1), ∫1/x dx = ln|x| + C, ∫e^x dx = e^x + C, ∫sin(x)dx = -cos(x) + C. U-substitution: ∫f(g(x))g'(x)dx, let u = g(x). Integration by parts: ∫u dv = uv - ∫v du (LIATE rule for choosing u). Partial fractions for rational functions. Trigonometric substitution: sqrt(a^2-x^2) use x=a*sin(t), sqrt(a^2+x^2) use x=a*tan(t), sqrt(x^2-a^2) use x=a*sec(t).

## Sequences and Series
A sequence {a_n} converges if lim(n->inf) a_n = L exists. A series Σa_n converges if the partial sums converge. Geometric series: Σar^n = a/(1-r) for |r|<1. p-series: Σ1/n^p converges iff p>1. Tests: Divergence test (if a_n doesn't -> 0, diverges), Integral test, Comparison test, Limit comparison, Ratio test (lim|a_{n+1}/a_n| < 1 converges), Root test, Alternating series test. Absolute vs conditional convergence. Power series: Σc_n(x-a)^n, radius of convergence R = 1/lim|c_{n+1}/c_n|. Taylor series: f(x) = Σ f^(n)(a)/n! * (x-a)^n. Key: e^x = Σx^n/n!, sin(x) = Σ(-1)^n x^(2n+1)/(2n+1)!, cos(x) = Σ(-1)^n x^(2n)/(2n)!, 1/(1-x) = Σx^n.

## Multivariable Calculus
Partial derivatives: ∂f/∂x holds y constant. Gradient: ∇f = (∂f/∂x, ∂f/∂y, ...) points in direction of steepest ascent. Directional derivative: D_u f = ∇f · u. Chain rule: dz/dt = (∂z/∂x)(dx/dt) + (∂z/∂y)(dy/dt). Second derivative test for f(x,y): compute D = f_xx*f_yy - (f_xy)^2 at critical point. D>0 and f_xx>0: local min. D>0 and f_xx<0: local max. D<0: saddle point. Multiple integrals: iterate, change order of integration. Jacobian for change of variables. Polar: dA = r dr dθ. Cylindrical: dV = r dr dθ dz. Spherical: dV = ρ^2 sin(φ) dρ dφ dθ.

## Vector Calculus
Line integrals: ∫_C F·dr = ∫[a,b] F(r(t))·r'(t)dt. Conservative fields: F = ∇f iff curl F = 0 (on simply connected domain), then ∫_C F·dr = f(B) - f(A). Green's theorem: ∮_C (P dx + Q dy) = ∬_D (∂Q/∂x - ∂P/∂y) dA. Curl: ∇ × F. Divergence: ∇ · F. Stokes' theorem: ∮_C F·dr = ∬_S (∇ × F)·dS. Divergence theorem: ∯_S F·dS = ∭_V (∇ · F) dV. Surface integrals: parametrize surface, compute r_u × r_v for normal. Flux integrals: ∬_S F · (r_u × r_v) du dv.
