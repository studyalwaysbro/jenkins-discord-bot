category: mathematics

## Information Theory — Entropy and Mutual Information
Shannon entropy: H(X) = -Σ p(x) log_2 p(x), measures average information/surprise. Maximum entropy: uniform distribution. Joint entropy: H(X,Y) = -Σ p(x,y) log p(x,y). Conditional entropy: H(Y|X) = H(X,Y) - H(X). Chain rule: H(X,Y) = H(X) + H(Y|X). Mutual information: I(X;Y) = H(X) - H(X|Y) = H(X) + H(Y) - H(X,Y) ≥ 0. I(X;Y) = 0 iff X,Y independent. Data processing inequality: if X -> Y -> Z (Markov chain), then I(X;Z) ≤ I(X;Y). Entropy rate: limit of H(X_1,...,X_n)/n for stochastic processes.

## Information Theory — KL Divergence and Cross-Entropy
KL divergence: D_KL(P||Q) = Σ p(x) log(p(x)/q(x)) ≥ 0 (Gibbs' inequality). Not symmetric, not a metric. Cross-entropy: H(P,Q) = -Σ p(x) log q(x) = H(P) + D_KL(P||Q). Minimizing cross-entropy equivalent to minimizing KL divergence when P is fixed (true distribution). This is why cross-entropy is the standard loss for classification. Jensen-Shannon divergence: JSD(P||Q) = [D_KL(P||M) + D_KL(Q||M)]/2 where M = (P+Q)/2, symmetric, bounded. f-divergence: generalization including KL, chi-squared, total variation.

## Information Theory — Coding and Channel Capacity
Source coding theorem: optimal lossless compression achieves rate ≥ H(X). Huffman coding: prefix-free, optimal for known distribution. Arithmetic coding: approaches entropy more closely. Channel capacity: C = max_{p(x)} I(X;Y). Binary symmetric channel: C = 1 - H(p) where p is crossover probability. AWGN channel: C = (1/2)log_2(1 + SNR) (Shannon-Hartley). Channel coding theorem: reliable communication possible at rates ≤ C, impossible above. Rate-distortion theory: minimum rate R(D) for lossy compression with distortion ≤ D. R(D) = min_{p(ŷ|y): E[d(Y,Ŷ)]≤D} I(Y;Ŷ).

## Network Theory — Graph Metrics and Centrality
Degree centrality: fraction of nodes connected to. Betweenness centrality: fraction of shortest paths passing through node. Closeness centrality: inverse of average shortest path distance. Eigenvector centrality: proportional to sum of centralities of neighbors (PageRank is variant with damping). Clustering coefficient: fraction of neighbor pairs that are connected (transitivity). Average path length: mean shortest path over all pairs. Diameter: longest shortest path. Degree distribution P(k): fraction of nodes with degree k. Power-law: P(k) ~ k^{-γ} (scale-free networks).

## Network Theory — Random Graph Models
Erdős-Rényi G(n,p): each edge independently with probability p. Giant component emerges at p = 1/n. Degree distribution: Binomial → Poisson for large n. Small diameter: O(log n). Barabási-Albert (preferential attachment): new nodes connect preferentially to high-degree nodes, produces power-law P(k) ~ k^{-3}. Watts-Strogatz (small-world): start with regular lattice, rewire edges randomly. High clustering + short paths. Configuration model: specify degree sequence, connect randomly. Stochastic block model: community structure, inter/intra community edge probabilities.

## Network Theory — Community Detection and Spectral Methods
Modularity: Q = (1/2m)Σ[A_{ij} - k_ik_j/2m]δ(c_i,c_j), measures quality of partition. Louvain algorithm: greedy modularity optimization, hierarchical. Girvan-Newman: remove edges with highest betweenness iteratively. Spectral clustering: use eigenvectors of Laplacian L = D - A. Graph Laplacian properties: positive semidefinite, smallest eigenvalue 0 (multiplicity = number of components). Fiedler vector (second smallest eigenvector): bisects graph. Normalized cut: spectral relaxation of min-cut problem. Random walks on graphs: stationary distribution proportional to degree for undirected.
