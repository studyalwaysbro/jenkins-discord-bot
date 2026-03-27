category: programming

## Python Gotchas

**Mutable default arguments** — the single most common Python bug people hit:
```python
# BROKEN — the list is shared across ALL calls
def add_item(item, items=[]):
    items.append(item)
    return items

add_item(1)  # [1]
add_item(2)  # [1, 2] — wait what?

# FIX — use None as sentinel
def add_item(item, items=None):
    if items is None:
        items = []
    items.append(item)
    return items
```

**Global vs local scope** — Python decides at parse time whether a variable is local:
```python
x = 10
def broken():
    print(x)   # UnboundLocalError — Python sees the assignment below and marks x as local
    x = 20

def fixed():
    global x
    print(x)
    x = 20
```

**The GIL (Global Interpreter Lock)** — CPython only allows one thread to execute Python bytecode at a time. This means:
- CPU-bound work: threads do NOT give you parallelism. Use `multiprocessing` or `concurrent.futures.ProcessPoolExecutor`.
- I/O-bound work: threads ARE fine because the GIL is released during I/O waits.
- `asyncio` is single-threaded and cooperative — no GIL issues but also no CPU parallelism.

**Shallow vs deep copy:**
```python
import copy

original = [[1, 2], [3, 4]]
shallow = original.copy()        # or list(original) or original[:]
deep = copy.deepcopy(original)

original[0].append(99)
print(shallow[0])  # [1, 2, 99] — inner lists are still shared
print(deep[0])     # [1, 2] — fully independent
```

**`is` vs `==`:**
- `==` checks value equality
- `is` checks identity (same object in memory)
- Python interns small integers (-5 to 256) and short strings, so `is` sometimes "works" by accident. Never rely on it for value comparison.

**Late binding closures:**
```python
# BROKEN
funcs = [lambda: i for i in range(5)]
[f() for f in funcs]  # [4, 4, 4, 4, 4] — all closures share the same i

# FIX — capture with default arg
funcs = [lambda i=i: i for i in range(5)]
[f() for f in funcs]  # [0, 1, 2, 3, 4]
```

## Python Core Patterns

**List comprehensions and generator expressions:**
```python
# List comp — builds entire list in memory
squares = [x**2 for x in range(1000)]

# Generator expression — lazy, memory efficient
squares_gen = (x**2 for x in range(1000))

# Nested comprehension (read left to right, outer to inner)
flat = [x for row in matrix for x in row]

# Dict comprehension
word_lengths = {word: len(word) for word in words}

# Set comprehension
unique_lengths = {len(word) for word in words}

# Filtering
evens = [x for x in range(100) if x % 2 == 0]

# Walrus operator in comprehension (3.8+)
results = [y for x in data if (y := expensive(x)) is not None]
```

**Decorators** — functions that wrap other functions:
```python
import functools
import time

def timer(func):
    @functools.wraps(func)  # preserves __name__, __doc__
    def wrapper(*args, **kwargs):
        start = time.perf_counter()
        result = func(*args, **kwargs)
        elapsed = time.perf_counter() - start
        print(f"{func.__name__} took {elapsed:.4f}s")
        return result
    return wrapper

@timer
def slow_function():
    time.sleep(1)

# Decorator with arguments — needs an extra layer
def retry(max_attempts=3):
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_attempts - 1:
                        raise
        return wrapper
    return decorator

@retry(max_attempts=5)
def flaky_api_call():
    ...
```

**Context managers:**
```python
# Basic usage — guarantees cleanup
with open("file.txt") as f:
    data = f.read()
# f is closed here even if an exception occurred

# Custom context manager with class
class Timer:
    def __enter__(self):
        self.start = time.perf_counter()
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        self.elapsed = time.perf_counter() - self.start
        return False  # don't suppress exceptions

# Custom context manager with contextlib
from contextlib import contextmanager

@contextmanager
def temp_directory():
    path = tempfile.mkdtemp()
    try:
        yield path
    finally:
        shutil.rmtree(path)
```

## Python Async

```python
import asyncio
import aiohttp

# Basic async function
async def fetch_url(url):
    async with aiohttp.ClientSession() as session:
        async with session.get(url) as response:
            return await response.text()

# Run multiple coroutines concurrently
async def fetch_all(urls):
    tasks = [fetch_url(url) for url in urls]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return results

# Running from synchronous code
asyncio.run(fetch_all(["https://example.com"]))

# Common mistake: forgetting to await
result = fetch_url("...")    # This is a coroutine OBJECT, not the result
result = await fetch_url("...")  # This actually runs it

# async for — iterate over async generator
async for message in websocket:
    process(message)

# async with — async context manager
async with aiofiles.open("big.txt") as f:
    contents = await f.read()
```

Key rules: `await` can only be used inside `async def`. You cannot mix sync and async code without explicit bridges (`asyncio.run`, `loop.run_in_executor`). Blocking calls inside async functions block the entire event loop.

## Python Virtual Environments and Packages

```bash
# Create a venv
python -m venv .venv

# Activate it
source .venv/bin/activate     # Linux/Mac
.venv\Scripts\activate        # Windows

# Install packages
pip install requests flask
pip install -r requirements.txt

# Freeze current packages
pip freeze > requirements.txt

# Deactivate
deactivate
```

**Common packages people ask about:**
- HTTP: `requests` (sync), `httpx` or `aiohttp` (async)
- Web frameworks: `flask` (simple), `fastapi` (async + auto docs), `django` (batteries included)
- Data: `pandas`, `numpy`, `polars` (faster pandas alternative)
- DB: `sqlalchemy` (ORM), `psycopg2` (postgres), `sqlite3` (built-in)
- Testing: `pytest`, `unittest` (built-in)
- CLI: `click`, `argparse` (built-in), `typer`
- Env vars: `python-dotenv`
- Dates: `arrow` or `pendulum` (nicer than datetime)

**uv** — the new fast Python package manager. Drop-in replacement for pip and venv:
```bash
uv venv .venv
uv pip install requests
uv pip compile requirements.in -o requirements.txt
```

## Python Type Hints

```python
from typing import Optional, Union, List, Dict, Tuple, Callable, TypeVar, Generic

# Basic types
def greet(name: str) -> str:
    return f"Hello, {name}"

# Optional = Union[X, None]
def find_user(id: int) -> Optional[User]:
    ...

# Collections (Python 3.9+ can use built-in types: list[int])
def process(items: List[int]) -> Dict[str, float]:
    ...

# Callable
def apply(func: Callable[[int, int], int], a: int, b: int) -> int:
    return func(a, b)

# TypeVar for generics
T = TypeVar("T")
def first(items: list[T]) -> T:
    return items[0]

# TypedDict for structured dicts
from typing import TypedDict
class UserDict(TypedDict):
    name: str
    age: int
    email: str | None   # 3.10+ union syntax

# Literal types
from typing import Literal
def set_mode(mode: Literal["read", "write"]) -> None:
    ...

# Running mypy
# pip install mypy
# mypy your_file.py --strict
```

Type hints are NOT enforced at runtime. They are for tooling (mypy, IDE autocomplete, documentation).

## JavaScript — var vs let vs const, Hoisting, Closures

**var vs let vs const:**
```javascript
// var — function-scoped, hoisted, can be redeclared. Avoid it.
var x = 1;

// let — block-scoped, not hoisted (TDZ), can be reassigned
let y = 2;
y = 3; // fine

// const — block-scoped, not hoisted (TDZ), cannot be reassigned
const z = 4;
z = 5; // TypeError

// BUT const objects/arrays CAN be mutated
const arr = [1, 2, 3];
arr.push(4); // fine — you're mutating, not reassigning
```

**Hoisting:**
```javascript
console.log(a); // undefined — var is hoisted but not initialized
var a = 5;

console.log(b); // ReferenceError — let has a "temporal dead zone"
let b = 5;

// Function declarations are fully hoisted
greet(); // works
function greet() { console.log("hi"); }

// Function expressions are NOT
greet(); // TypeError: greet is not a function
var greet = function() { console.log("hi"); };
```

**Closures** — a function that remembers variables from its enclosing scope:
```javascript
function makeCounter() {
    let count = 0;
    return {
        increment: () => ++count,
        getCount: () => count
    };
}
const counter = makeCounter();
counter.increment(); // 1
counter.increment(); // 2

// Classic loop gotcha (same concept as Python late binding)
for (var i = 0; i < 5; i++) {
    setTimeout(() => console.log(i), 100); // prints 5 five times
}
// Fix: use let (block-scoped per iteration)
for (let i = 0; i < 5; i++) {
    setTimeout(() => console.log(i), 100); // 0, 1, 2, 3, 4
}
```

## JavaScript — Promises, Async/Await, Event Loop

**Promises:**
```javascript
// Creating a promise
const promise = new Promise((resolve, reject) => {
    setTimeout(() => resolve("done"), 1000);
});

// Consuming
promise
    .then(result => console.log(result))
    .catch(error => console.error(error))
    .finally(() => console.log("cleanup"));

// Promise combinators
Promise.all([p1, p2, p3])      // waits for ALL, fails fast on first rejection
Promise.allSettled([p1, p2])    // waits for ALL, never rejects
Promise.race([p1, p2])         // first to settle (resolve or reject)
Promise.any([p1, p2])          // first to resolve (ignores rejections until all fail)
```

**Async/await:**
```javascript
async function fetchData() {
    try {
        const response = await fetch("/api/data");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Fetch failed:", error);
        throw error; // re-throw if you want callers to handle it
    }
}

// Parallel execution
const [users, posts] = await Promise.all([
    fetch("/api/users").then(r => r.json()),
    fetch("/api/posts").then(r => r.json())
]);
```

**Event loop** — the thing everyone gets wrong in interviews:
1. Call stack executes synchronous code
2. When stack is empty, event loop checks the **microtask queue** (Promise callbacks, queueMicrotask)
3. After microtask queue is drained, checks **macrotask queue** (setTimeout, setInterval, I/O)
4. Repeat

```javascript
console.log("1");
setTimeout(() => console.log("2"), 0);
Promise.resolve().then(() => console.log("3"));
console.log("4");
// Output: 1, 4, 3, 2 — microtasks before macrotasks
```

## JavaScript — this Binding and Arrow Functions

```javascript
// Regular function: `this` depends on HOW it's called
const obj = {
    name: "Jenkins",
    greet() { console.log(this.name); }
};
obj.greet();           // "Jenkins" — called as method
const fn = obj.greet;
fn();                  // undefined — called as standalone function (this = globalThis)

// Arrow functions: `this` is captured from enclosing scope at definition time
const obj2 = {
    name: "Jenkins",
    greet: () => console.log(this.name) // `this` is whatever `this` was OUTSIDE obj2
};

// Where arrow functions shine — callbacks
class Bot {
    constructor(name) { this.name = name; }
    delayedGreet() {
        // Arrow captures `this` from delayedGreet's scope
        setTimeout(() => console.log(this.name), 1000); // works
        // Regular function would lose `this`
        setTimeout(function() { console.log(this.name); }, 1000); // undefined
    }
}

// Explicit binding
fn.call(obj);           // call with this = obj, args individually
fn.apply(obj, [args]);  // call with this = obj, args as array
const bound = fn.bind(obj); // returns new function with this permanently bound
```

## Node.js Common Patterns

```javascript
// ES Modules (modern) vs CommonJS
import express from "express";        // ESM
const express = require("express");   // CommonJS

// Environment variables
import "dotenv/config";
const port = process.env.PORT || 3000;

// Error handling in Express
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: "Internal server error" });
});

// Graceful shutdown
process.on("SIGTERM", async () => {
    console.log("Shutting down...");
    await server.close();
    await db.disconnect();
    process.exit(0);
});

// Event emitter pattern
import { EventEmitter } from "events";
const emitter = new EventEmitter();
emitter.on("data", (payload) => console.log(payload));
emitter.emit("data", { msg: "hello" });

// Streams — for processing large data without loading it all into memory
import { createReadStream } from "fs";
const stream = createReadStream("huge-file.txt", { encoding: "utf8" });
stream.on("data", (chunk) => process(chunk));
stream.on("end", () => console.log("done"));
```

## TypeScript Basics

```typescript
// Interfaces — describe object shapes
interface User {
    id: number;
    name: string;
    email?: string;       // optional
    readonly createdAt: Date; // immutable
}

// Type aliases — can do everything interfaces do, plus unions and intersections
type Result = "success" | "error" | "pending";
type ApiResponse<T> = { data: T; status: number };

// Generics
function wrapInArray<T>(item: T): T[] {
    return [item];
}

// Type narrowing
function process(value: string | number) {
    if (typeof value === "string") {
        return value.toUpperCase(); // TS knows it's a string here
    }
    return value.toFixed(2); // TS knows it's a number here
}

// Discriminated unions — incredibly useful pattern
type Shape =
    | { kind: "circle"; radius: number }
    | { kind: "rect"; width: number; height: number };

function area(shape: Shape): number {
    switch (shape.kind) {
        case "circle": return Math.PI * shape.radius ** 2;
        case "rect": return shape.width * shape.height;
    }
}

// Utility types
Partial<User>          // all fields optional
Required<User>         // all fields required
Pick<User, "id" | "name">  // subset of fields
Omit<User, "email">   // all except specified
Record<string, number> // { [key: string]: number }
ReturnType<typeof fn>  // infer return type of a function

// as const — makes literal types
const DIRECTIONS = ["north", "south", "east", "west"] as const;
type Direction = typeof DIRECTIONS[number]; // "north" | "south" | "east" | "west"

// Non-null assertion (use sparingly)
const el = document.getElementById("app")!; // tells TS it's not null

// Type guards
function isUser(obj: unknown): obj is User {
    return typeof obj === "object" && obj !== null && "id" in obj;
}
```

## Big O Notation

**What it measures:** How an algorithm's time or space scales as input size grows. Constants and lower-order terms are dropped.

| Notation | Name | Example | Feel |
|----------|------|---------|------|
| O(1) | Constant | Hash map lookup, array index access | Instant |
| O(log n) | Logarithmic | Binary search, balanced BST lookup | Very fast even for huge n |
| O(n) | Linear | Linear search, iterating an array | Scales with input |
| O(n log n) | Linearithmic | Merge sort, good sorting algorithms | Where most sorts live |
| O(n^2) | Quadratic | Nested loops, bubble sort | Painful past n=10,000 |
| O(2^n) | Exponential | Naive recursive Fibonacci, power set | Unusable past n=25-30 |
| O(n!) | Factorial | Permutations, naive TSP | Unusable past n=12-15 |

**Quick rules:**
- Single loop over n items = O(n)
- Nested loop over n items = O(n^2)
- Halving the search space each step = O(log n)
- Sorting then doing something = at least O(n log n)
- If you see `for i in range(n): for j in range(i, n):` that is still O(n^2), just n(n-1)/2

**Amortized analysis:** ArrayList/vector append is O(1) amortized. Individual resizes are O(n), but they happen so rarely that averaged over all operations it is constant.

## Data Structures

**Array (list in Python, Array in JS):**
- Access by index: O(1)
- Search: O(n)
- Insert/delete at end: O(1) amortized
- Insert/delete at beginning/middle: O(n) — everything shifts
- Use when: random access needed, mostly appending

**Linked List:**
- Access by index: O(n) — must traverse
- Insert/delete at known position: O(1)
- Search: O(n)
- Use when: frequent insertions/deletions at arbitrary positions, no random access needed
- In practice: rarely better than arrays due to cache locality

**Stack (LIFO):**
- Push/pop: O(1)
- Use when: undo operations, matching parentheses, DFS, backtracking
- Python: just use a list (`append` and `pop`)
- JS: just use an array (`push` and `pop`)

**Queue (FIFO):**
- Enqueue/dequeue: O(1)
- Use when: BFS, task scheduling, buffering
- Python: `collections.deque` (NOT list — list.pop(0) is O(n))
- JS: arrays work but shift() is O(n). For performance, use a linked list or ring buffer.

**Hash Map (dict in Python, Object/Map in JS):**
- Get/set/delete: O(1) average, O(n) worst case (hash collisions)
- Use when: fast lookups, counting, grouping, caching
- Python dict is ordered by insertion (3.7+). JS Object keys are... complicated. Use Map for guaranteed order.

**Binary Search Tree:**
- Search/insert/delete: O(log n) average, O(n) worst case (degenerate/unbalanced)
- Balanced variants (AVL, Red-Black): O(log n) guaranteed
- Use when: ordered data, range queries, floor/ceiling lookups

**Heap (Priority Queue):**
- Insert: O(log n)
- Get min/max: O(1)
- Extract min/max: O(log n)
- Python: `heapq` (min-heap). For max-heap, negate values.
- Use when: "find the k largest/smallest", scheduling, Dijkstra's

**Trie (Prefix Tree):**
- Insert/search: O(m) where m = word length
- Use when: autocomplete, spell check, prefix matching

**Graph:**
- Adjacency list: space O(V + E), good for sparse graphs
- Adjacency matrix: space O(V^2), good for dense graphs, O(1) edge lookup

```python
# Adjacency list — most common representation
graph = {
    "A": ["B", "C"],
    "B": ["A", "D"],
    "C": ["A"],
    "D": ["B"]
}

# Weighted edges
graph = {
    "A": [("B", 5), ("C", 3)],
    "B": [("A", 5), ("D", 2)]
}
```

## Sorting Algorithms

**Quick Sort:**
- Average: O(n log n), Worst: O(n^2) — when pivot selection is bad
- In-place (O(log n) stack space)
- Fast in practice due to cache locality
- Unstable (equal elements may be reordered)
- Use when: general purpose, memory constrained

**Merge Sort:**
- Always O(n log n) — no bad worst case
- NOT in-place — requires O(n) extra space
- Stable (preserves relative order of equal elements)
- Use when: stability matters, linked lists, external sorting (files)

**Heap Sort:**
- Always O(n log n)
- In-place but not stable
- Use when: guaranteed O(n log n) with O(1) space

**Tim Sort** (what Python and JS actually use):
- Hybrid of merge sort and insertion sort
- O(n log n) worst case, O(n) on nearly sorted data
- Stable
- This is what `list.sort()` and `Array.sort()` use. You almost never need to implement your own sort.

**When to use which:**
- Default: just use the language's built-in sort (Tim Sort). It's almost always the right choice.
- Need stability: merge sort or Tim Sort
- Memory constrained: quick sort or heap sort
- Nearly sorted data: insertion sort or Tim Sort
- Small arrays (n < 20): insertion sort (used internally by Tim Sort)

## Search and Graph Algorithms

**Binary Search:**
```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1  # not found

# Python built-in: bisect module
import bisect
idx = bisect.bisect_left(sorted_arr, target)
```
**Requires sorted input.** Off-by-one errors are the #1 bug. Be very careful with lo, hi, and mid boundaries.

**BFS (Breadth-First Search):**
```python
from collections import deque

def bfs(graph, start):
    visited = {start}
    queue = deque([start])
    while queue:
        node = queue.popleft()
        for neighbor in graph[node]:
            if neighbor not in visited:
                visited.add(neighbor)
                queue.append(neighbor)
    return visited
```
- Uses a QUEUE. Explores level by level.
- Finds shortest path in unweighted graphs.
- Time: O(V + E)

**DFS (Depth-First Search):**
```python
def dfs(graph, start):
    visited = set()
    stack = [start]
    while stack:
        node = stack.pop()
        if node not in visited:
            visited.add(node)
            for neighbor in graph[node]:
                stack.append(neighbor)
    return visited

# Recursive version
def dfs_recursive(graph, node, visited=None):
    if visited is None:
        visited = set()
    visited.add(node)
    for neighbor in graph[node]:
        if neighbor not in visited:
            dfs_recursive(graph, neighbor, visited)
    return visited
```
- Uses a STACK (or recursion). Explores depth first.
- Better for: detecting cycles, topological sort, finding connected components
- Time: O(V + E)

**Dijkstra's (Shortest Path with Weights):**
```python
import heapq

def dijkstra(graph, start):
    distances = {start: 0}
    heap = [(0, start)]
    while heap:
        dist, node = heapq.heappop(heap)
        if dist > distances.get(node, float('inf')):
            continue
        for neighbor, weight in graph[node]:
            new_dist = dist + weight
            if new_dist < distances.get(neighbor, float('inf')):
                distances[neighbor] = new_dist
                heapq.heappush(heap, (new_dist, neighbor))
    return distances
```
- Only works with non-negative weights. For negative weights, use Bellman-Ford.
- Time: O((V + E) log V) with a binary heap.

## Dynamic Programming

The core idea: break a problem into overlapping subproblems, solve each once, store the result.

**Two approaches:**
1. **Top-down (memoization):** recursive + cache
2. **Bottom-up (tabulation):** iterative, build up from base cases

```python
# Fibonacci — classic DP example

# Top-down with memoization
from functools import lru_cache

@lru_cache(maxsize=None)
def fib(n):
    if n <= 1:
        return n
    return fib(n - 1) + fib(n - 2)

# Bottom-up with tabulation
def fib(n):
    if n <= 1:
        return n
    dp = [0] * (n + 1)
    dp[1] = 1
    for i in range(2, n + 1):
        dp[i] = dp[i-1] + dp[i-2]
    return dp[n]

# Space-optimized — only keep last two values
def fib(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b
```

**How to recognize DP problems:**
1. "Find the minimum/maximum/number of ways to..."
2. Choices at each step that affect future choices
3. Overlapping subproblems (same computation repeated)
4. Optimal substructure (optimal solution contains optimal solutions to subproblems)

**Common DP problems:** Coin change, knapsack, longest common subsequence, edit distance, longest increasing subsequence, matrix chain multiplication, unique paths in grid.

## Common Interview Patterns

**Two Pointers:**
```python
# Two sum on SORTED array
def two_sum_sorted(nums, target):
    left, right = 0, len(nums) - 1
    while left < right:
        total = nums[left] + nums[right]
        if total == target:
            return [left, right]
        elif total < target:
            left += 1
        else:
            right -= 1

# Remove duplicates in place
def remove_duplicates(nums):
    if not nums:
        return 0
    write = 1
    for read in range(1, len(nums)):
        if nums[read] != nums[read - 1]:
            nums[write] = nums[read]
            write += 1
    return write
```

**Sliding Window:**
```python
# Maximum sum subarray of size k
def max_sum_subarray(nums, k):
    window_sum = sum(nums[:k])
    max_sum = window_sum
    for i in range(k, len(nums)):
        window_sum += nums[i] - nums[i - k]
        max_sum = max(max_sum, window_sum)
    return max_sum

# Variable-size window: longest substring with at most k distinct characters
def longest_k_distinct(s, k):
    counts = {}
    left = max_len = 0
    for right in range(len(s)):
        counts[s[right]] = counts.get(s[right], 0) + 1
        while len(counts) > k:
            counts[s[left]] -= 1
            if counts[s[left]] == 0:
                del counts[s[left]]
            left += 1
        max_len = max(max_len, right - left + 1)
    return max_len
```

**Hash Map for O(1) Lookups:**
```python
# Two sum (unsorted) — the classic
def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        complement = target - num
        if complement in seen:
            return [seen[complement], i]
        seen[num] = i
```

**Fast and Slow Pointers (Floyd's):**
```python
# Detect cycle in linked list
def has_cycle(head):
    slow = fast = head
    while fast and fast.next:
        slow = slow.next
        fast = fast.next.next
        if slow is fast:
            return True
    return False
```

**Backtracking:**
```python
# Generate all permutations
def permutations(nums):
    result = []
    def backtrack(path, remaining):
        if not remaining:
            result.append(path[:])
            return
        for i in range(len(remaining)):
            path.append(remaining[i])
            backtrack(path, remaining[:i] + remaining[i+1:])
            path.pop()  # undo choice
    backtrack([], nums)
    return result
```

**Monotonic Stack:**
```python
# Next greater element
def next_greater(nums):
    result = [-1] * len(nums)
    stack = []  # indices
    for i in range(len(nums)):
        while stack and nums[i] > nums[stack[-1]]:
            result[stack.pop()] = nums[i]
        stack.append(i)
    return result
```

## Git Workflow

**Basic daily workflow:**
```bash
git status                    # see what's changed
git add file.py              # stage specific file
git add -p                    # stage interactively (hunk by hunk)
git commit -m "fix: handle null case in parser"
git push origin main

git pull                     # fetch + merge (safe for most cases)
git pull --rebase            # fetch + rebase (cleaner history)
```

**Branching:**
```bash
git branch feature/new-thing     # create branch
git checkout -b feature/new-thing # create and switch (shorthand)
git switch -c feature/new-thing   # modern alternative to checkout -b

git checkout main                # switch to main
git merge feature/new-thing      # merge branch into current branch
git branch -d feature/new-thing  # delete branch (only if merged)
git branch -D feature/new-thing  # force delete (even if not merged)
```

**Rebase vs Merge:**
- `git merge` creates a merge commit. History shows exactly when branches diverged and joined. Can look messy with many branches.
- `git rebase` replays your commits on top of the target. Linear history. Cleaner log. **Never rebase commits that have been pushed and shared with others.**

```bash
# Rebase workflow
git checkout feature-branch
git rebase main               # replay feature commits on top of main
git checkout main
git merge feature-branch      # now it's a fast-forward

# Interactive rebase — squash, reorder, edit commits
git rebase -i HEAD~3          # edit last 3 commits
```

**Cherry-pick, stash, bisect:**
```bash
# Cherry-pick — apply a specific commit from another branch
git cherry-pick abc123

# Stash — temporarily shelve changes
git stash                     # stash everything
git stash push -m "wip: auth" # stash with a name
git stash list                # see all stashes
git stash pop                 # apply most recent stash and remove it
git stash apply               # apply but keep in stash list

# Bisect — binary search for the commit that introduced a bug
git bisect start
git bisect bad                # current commit is bad
git bisect good abc123        # this old commit was good
# Git checks out a middle commit. Test it, then:
git bisect good               # or git bisect bad
# Repeat until it finds the offending commit
git bisect reset              # done, return to normal
```

## Git Disaster Recovery

```bash
# Undo last commit but KEEP changes staged
git reset --soft HEAD~1

# Undo last commit and UNSTAGE changes (keep files)
git reset HEAD~1              # or --mixed (default)

# Undo last commit and DISCARD everything (dangerous)
git reset --hard HEAD~1

# "I accidentally ran reset --hard and lost my work"
git reflog                    # shows ALL recent HEAD positions
git reset --hard abc123       # go back to a reflog entry

# Undo a pushed commit (safe — creates a new revert commit)
git revert abc123

# Discard all uncommitted changes
git checkout -- .             # old way
git restore .                 # modern way

# Unstage a file
git reset HEAD file.py        # old way
git restore --staged file.py  # modern way

# "I committed to the wrong branch"
git stash
git checkout correct-branch
git stash pop

# Or using cherry-pick
git checkout correct-branch
git cherry-pick abc123
git checkout wrong-branch
git reset --hard HEAD~1
```

**The golden rule:** `git reflog` can save you from almost anything. Commits are not truly deleted for ~30 days (until garbage collected).

## Debugging

**Rubber duck debugging:** Explain the problem out loud, line by line, to an inanimate object. The act of articulating forces you to slow down and often reveals the flaw. Seriously works.

**Binary search for bugs:**
1. Comment out half the code (or the recent changes)
2. Does the bug still happen?
3. If yes, the bug is in the remaining half. If no, it is in what you commented out.
4. Repeat on the guilty half. Converges fast.

**Reading stack traces:**
- Read from the BOTTOM up. The bottom is your code; the top is library/framework internals.
- The last line of your code before it enters library code is usually where the bug is.
- Look for the file and line number that's in YOUR code.

```python
# Python traceback — read bottom to top
Traceback (most recent call last):
  File "app.py", line 45, in main        # <-- start here
    result = process(data)
  File "app.py", line 23, in process
    return data["missing_key"]            # <-- the actual error
KeyError: 'missing_key'                   # <-- the exception type and message
```

```javascript
// JS stack trace — read top to bottom (opposite of Python)
TypeError: Cannot read properties of undefined (reading 'name')
    at getUser (app.js:23:15)             // <-- the actual error line
    at processRequest (app.js:45:10)
    at Server.<anonymous> (app.js:67:5)
```

**Common error types and what they actually mean:**

Python:
- `TypeError: 'NoneType' object is not subscriptable` — you called `[something]` on None. A function returned None when you expected a dict/list.
- `KeyError` — dict doesn't have that key. Use `.get(key, default)` instead.
- `AttributeError: 'X' has no attribute 'Y'` — wrong type, or the object is None.
- `ImportError` / `ModuleNotFoundError` — wrong venv, package not installed, or circular import.
- `IndentationError` — mixed tabs and spaces, or copy-paste mangled whitespace.
- `RecursionError` — infinite recursion. Check your base case.

JavaScript:
- `TypeError: X is not a function` — you called something that isn't callable. Often: wrong import, accessing wrong property, or the value is undefined.
- `TypeError: Cannot read properties of undefined` — you chained `.something` on undefined. Use optional chaining: `obj?.prop?.nested`.
- `ReferenceError: X is not defined` — variable doesn't exist in scope. Typo, missing import, or scoping issue.
- `SyntaxError: Unexpected token` — malformed JSON, missing bracket/paren, or using modern syntax in an old runtime.

**Print debugging (when you just need it to work at 2 AM):**
```python
# Python — f-strings are your friend
print(f"DEBUG: {variable=}")     # Python 3.8+ — prints "variable=value"
print(f"DEBUG: type={type(x)}, len={len(x)}, val={x!r}")

# Or use breakpoint()
breakpoint()  # drops into pdb at this line

# In pdb:
# n = next line, s = step into, c = continue, p var = print var, q = quit
```

```javascript
// JS
console.log("DEBUG:", { variable, type: typeof variable });
console.table(arrayOfObjects);   // pretty table in terminal
console.trace("how did I get here");  // print stack trace without throwing

// Node.js debugger
debugger;  // with --inspect flag, opens in Chrome DevTools
```

## HTTP Basics

**Methods:**
- `GET` — retrieve data. No body. Idempotent. Cacheable.
- `POST` — create something. Has body. NOT idempotent.
- `PUT` — replace entirely. Has body. Idempotent.
- `PATCH` — partial update. Has body. Not necessarily idempotent.
- `DELETE` — remove. Idempotent.

**Status codes people actually encounter:**
- `200` OK
- `201` Created (successful POST)
- `204` No Content (successful DELETE, nothing to return)
- `301` Moved Permanently (URL changed, update your bookmarks)
- `302/307` Temporary Redirect
- `304` Not Modified (cached version is still good)
- `400` Bad Request (your payload is malformed)
- `401` Unauthorized (not authenticated — missing/bad token)
- `403` Forbidden (authenticated but not authorized)
- `404` Not Found
- `405` Method Not Allowed (POST to a GET-only endpoint)
- `409` Conflict (e.g., resource already exists)
- `422` Unprocessable Entity (valid JSON but bad data)
- `429` Too Many Requests (rate limited)
- `500` Internal Server Error (server crashed)
- `502` Bad Gateway (reverse proxy can't reach the backend)
- `503` Service Unavailable (server overloaded or in maintenance)
- `504` Gateway Timeout

**Headers you should know:**
- `Content-Type: application/json` — what format the body is in
- `Authorization: Bearer <token>` — auth token
- `Accept: application/json` — what format you want back
- `Cache-Control` — caching rules
- `CORS headers` (`Access-Control-Allow-Origin`, etc.) — browser security for cross-origin requests

## REST vs GraphQL

**REST:**
- Resources have URLs: `/api/users/123`
- HTTP methods = operations (GET, POST, PUT, DELETE)
- Multiple endpoints, each returns a fixed shape
- Over-fetching: GET `/users/123` returns everything even if you just need the name
- Under-fetching: need user + posts + comments = 3 separate requests

**GraphQL:**
- Single endpoint: `/graphql`
- Client specifies exactly what data it needs
- One request can fetch nested related data
- More complex server-side, more flexible client-side

```graphql
# GraphQL query — get exactly what you need
query {
  user(id: 123) {
    name
    posts(limit: 5) {
      title
      commentCount
    }
  }
}
```

**When to use which:**
- REST: simpler, better caching (HTTP cache works naturally), better for public APIs, most teams should default to this
- GraphQL: complex frontend needs, many nested relationships, mobile apps that need minimal data transfer

## DNS and TCP/IP Basics

**DNS (Domain Name System):** Translates domain names to IP addresses.
1. Browser checks its cache
2. OS checks its cache
3. Query goes to recursive resolver (usually your ISP)
4. Resolver queries root servers -> TLD servers (.com) -> authoritative nameserver
5. IP address returned and cached (TTL determines how long)

**Common DNS records:**
- `A` — domain -> IPv4 address
- `AAAA` — domain -> IPv6 address
- `CNAME` — domain -> another domain (alias)
- `MX` — mail servers for the domain
- `TXT` — arbitrary text (SPF, DKIM, domain verification)

```bash
# Useful commands
nslookup example.com
dig example.com
```

**TCP/IP in 30 seconds:**
- IP handles addressing and routing (packets can arrive out of order, get lost)
- TCP adds reliability on top: connection establishment (3-way handshake: SYN, SYN-ACK, ACK), ordering, retransmission
- UDP skips all that — faster but unreliable (good for games, video streaming, DNS)
- Ports: 80 (HTTP), 443 (HTTPS), 22 (SSH), 5432 (Postgres), 3306 (MySQL)

## Docker Basics

```bash
# Images vs containers:
# Image = blueprint (like a class)
# Container = running instance (like an object)

# Run a container
docker run -d -p 3000:3000 --name myapp myimage:latest
#  -d = detached (background)
#  -p host:container = port mapping
#  --name = give it a name

# Common commands
docker ps                    # running containers
docker ps -a                 # all containers (including stopped)
docker logs myapp            # view logs
docker logs -f myapp         # follow logs (like tail -f)
docker exec -it myapp sh     # shell into running container
docker stop myapp
docker rm myapp
docker images                # list images
docker rmi myimage           # remove image

# Dockerfile basics
FROM node:20-alpine          # base image
WORKDIR /app                 # set working directory
COPY package*.json ./        # copy package files first (layer caching)
RUN npm install              # install deps (cached if package.json unchanged)
COPY . .                     # copy everything else
EXPOSE 3000                  # documentation (doesn't actually publish the port)
CMD ["node", "server.js"]    # default command

# Build
docker build -t myapp:latest .

# Docker Compose — multi-container setup
# docker-compose.yml
version: "3.8"
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgres://db:5432/myapp
    depends_on:
      - db
  db:
    image: postgres:16
    volumes:
      - pgdata:/var/lib/postgresql/data
    env_file: .env
volumes:
  pgdata:

# docker compose up -d
# docker compose down
# docker compose logs -f
```

**Volumes:** persist data beyond container lifecycle. Without a volume, container data is lost when the container is removed.

## SQL Basics

**JOIN types — the thing everyone draws on whiteboards:**
```sql
-- INNER JOIN: only matching rows from both tables
SELECT u.name, o.total
FROM users u
INNER JOIN orders o ON u.id = o.user_id;

-- LEFT JOIN: all rows from left table, matching from right (NULL if no match)
SELECT u.name, o.total
FROM users u
LEFT JOIN orders o ON u.id = o.user_id;
-- Users with no orders will appear with NULL total

-- RIGHT JOIN: all rows from right table (rarely used — just swap table order and use LEFT)

-- FULL OUTER JOIN: all rows from both, NULL where no match

-- CROSS JOIN: every row from A paired with every row from B (cartesian product). Rarely intentional.
```

**GROUP BY and aggregates:**
```sql
-- Count orders per user
SELECT u.name, COUNT(o.id) as order_count, SUM(o.total) as total_spent
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
GROUP BY u.name
HAVING COUNT(o.id) > 5        -- HAVING filters after GROUP BY (WHERE filters before)
ORDER BY total_spent DESC;
```

**Indexes:**
- Without index: full table scan O(n)
- With index (B-tree): O(log n) lookup
- Add indexes on columns you filter (WHERE), join (ON), or sort (ORDER BY) frequently
- Trade-off: indexes speed up reads but slow down writes (index must be updated)

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_users_username ON users(username);

-- Composite index — order matters! (leftmost prefix rule)
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
-- This index helps: WHERE user_id = 1 AND created_at > '2024-01-01'
-- This index helps: WHERE user_id = 1
-- This index does NOT help: WHERE created_at > '2024-01-01' (no leftmost column)
```

**Window functions** (the intermediate SQL thing people always have to look up):
```sql
-- Rank users by total spending
SELECT name, total_spent,
    ROW_NUMBER() OVER (ORDER BY total_spent DESC) as rank,
    RANK() OVER (ORDER BY total_spent DESC) as rank_with_ties,
    LAG(total_spent) OVER (ORDER BY total_spent DESC) as prev_amount,
    SUM(total_spent) OVER () as grand_total
FROM user_spending;

-- Partition: apply window function within groups
SELECT department, name, salary,
    AVG(salary) OVER (PARTITION BY department) as dept_avg
FROM employees;
```

**Common patterns:**
```sql
-- Upsert (INSERT or UPDATE on conflict)
INSERT INTO users (email, name) VALUES ('a@b.com', 'Alice')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;

-- CTEs (Common Table Expressions) — readable subqueries
WITH active_users AS (
    SELECT * FROM users WHERE last_login > NOW() - INTERVAL '30 days'
)
SELECT * FROM active_users WHERE plan = 'premium';
```

## Rust Essentials

**Ownership** — the core concept that makes Rust unique:
- Every value has exactly one owner
- When the owner goes out of scope, the value is dropped (freed)
- Assignment moves ownership (not copy, unless the type implements Copy)

```rust
let s1 = String::from("hello");
let s2 = s1;            // s1 is MOVED to s2. s1 is now invalid.
// println!("{}", s1);  // compile error: value borrowed after move

let s3 = s2.clone();    // explicit deep copy
```

**Borrowing** — references that do NOT take ownership:
```rust
fn calculate_length(s: &String) -> usize {  // immutable borrow
    s.len()
}

fn add_suffix(s: &mut String) {              // mutable borrow
    s.push_str(" world");
}

// Rules:
// 1. You can have EITHER one mutable reference OR any number of immutable references (not both)
// 2. References must always be valid (no dangling pointers)
```

**Lifetimes** — tell the compiler how long references are valid:
```rust
// This won't compile without lifetime annotation — compiler doesn't know
// if the returned reference lives as long as x or y
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
// 'a means: the returned reference is valid as long as BOTH inputs are valid
```

Most of the time the compiler infers lifetimes. You only annotate when it can't figure it out (usually functions returning references).

## C++ Essentials

**Pointers vs References:**
```cpp
int x = 42;

int* ptr = &x;      // pointer — stores memory address
*ptr = 99;           // dereference to access value
ptr = nullptr;       // can be null, can be reassigned

int& ref = x;       // reference — alias for x
ref = 99;            // no dereference needed, just use it
// References CANNOT be null and CANNOT be reassigned to refer to something else
```

**When to use which:**
- References: function parameters (avoid copies), when null is not a valid state
- Pointers: when you need null, dynamic memory, or need to change what you point to

**RAII (Resource Acquisition Is Initialization):**
The idea: tie resource lifetime to object lifetime. Constructor acquires, destructor releases. No manual cleanup needed.
```cpp
{
    std::ifstream file("data.txt");  // opened in constructor
    // use file...
}  // file automatically closed when it goes out of scope (destructor runs)
```

**Smart pointers — RAII for heap memory:**
```cpp
#include <memory>

// unique_ptr — sole ownership. Cannot be copied, only moved.
auto ptr = std::make_unique<Widget>(args);
// automatically deleted when ptr goes out of scope

// shared_ptr — reference counted. Multiple owners.
auto shared = std::make_shared<Widget>(args);
auto copy = shared;  // refcount = 2
// deleted when last shared_ptr goes out of scope

// weak_ptr — non-owning reference to shared_ptr. Breaks cycles.
std::weak_ptr<Widget> weak = shared;
if (auto locked = weak.lock()) {  // check if still alive
    // use locked
}

// RAW pointers (new/delete) — almost never use these in modern C++
// If you're writing new/delete, you're probably doing it wrong.
```

**Rule of thumb:** Use `unique_ptr` by default. Use `shared_ptr` only when you genuinely need shared ownership. Avoid raw `new`/`delete`.
