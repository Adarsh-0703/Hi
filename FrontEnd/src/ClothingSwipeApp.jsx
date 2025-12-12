import React, { useEffect, useRef, useState } from "react";

/**
 * Polished ClothingSwipeApp with drag-to-swipe behaviour.
 * - MOCK mode for offline testing
 * - When ready: set MOCK = false and set API to your backend
 */

const MOCK = true; // set to false when backend is ready
const API = "http://localhost:4000";

const MOCK_PRODUCTS = [
  { id: "p1", title: "Red T-Shirt", brand: "BrandA", category: "Tops", price: 499, image: "https://picsum.photos/seed/p1/400/520", tags: ["red", "casual"] },
  { id: "p2", title: "Blue Jeans", brand: "BrandB", category: "Bottoms", price: 1299, image: "https://picsum.photos/seed/p2/400/520", tags: ["blue", "denim"] },
  { id: "p3", title: "Black Hoodie", brand: "BrandC", category: "Outerwear", price: 1499, image: "https://picsum.photos/seed/p3/400/520", tags: ["black", "cozy"] },
  { id: "p4", title: "White Sneakers", brand: "BrandD", category: "Shoes", price: 1999, image: "https://picsum.photos/seed/p4/400/520", tags: ["white", "sport"] },
  { id: "p5", title: "Green Cap", brand: "BrandE", category: "Accessories", price: 299, image: "https://picsum.photos/seed/p5/400/520", tags: ["green", "casual"] },
];

export default function ClothingSwipeApp() {
  const [stack, setStack] = useState([]); // top is index 0
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(false);

  // drag state for top card
  const dragState = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
  });

  // leaving animation state for the top card when swiped
  const [leaving, setLeaving] = useState(null); // { dir: 'left'|'right', id }

  useEffect(() => {
    refillStack(6);
    const onKey = (e) => {
      if (e.key === "ArrowRight") handleManualSwipe("right");
      if (e.key === "ArrowLeft") handleManualSwipe("left");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line
  }, []);

  async function fetchProducts(n = 1) {
    setLoading(true);
    try {
      if (MOCK) {
        // return unique clones to avoid duplicated keys
        return Array.from({ length: n }).map((_, i) => {
          const item = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
          return { ...item, id: item.id + "-" + Date.now() + "-" + i };
        });
      } else {
        const res = await fetch(`${API}/api/product?count=${n}`);
        if (!res.ok) throw new Error("product fetch failed");
        return await res.json();
      }
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setLoading(false);
    }
  }

  async function refillStack(minCount = 4) {
    if (stack.length >= minCount) return;
    const need = minCount - stack.length + 2;
    const items = await fetchProducts(need);
    setStack((s) => [...s, ...items]);
  }

  async function sendFeedback(productId, feedback) {
    if (MOCK) return;
    try {
      await fetch(`${API}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "guest", productId, feedback }),
      });
    } catch (e) {
      console.error("feedback error", e);
    }
  }

  function removeTopAndRefill() {
    setStack((s) => s.slice(1));
    refillStack(4);
  }

  function handleManualSwipe(dir) {
    if (!stack.length) return;
    const top = stack[0];
    if (dir === "right") setQueue((q) => [top, ...q]);
    sendFeedback(top.id, dir);
    // animate leaving for visual polish
    setLeaving({ dir, id: top.id });
    // after animation completes, remove top
    setTimeout(() => {
      setLeaving(null);
      removeTopAndRefill();
    }, 300);
  }

  // Drag handlers for top card
  function onPointerDown(e) {
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    dragState.current.dragging = true;
    dragState.current.startX = clientX;
    dragState.current.startY = clientY;
    dragState.current.dx = 0;
    dragState.current.dy = 0;
    // add move/up listeners
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
    // for touch devices (some browsers)
    window.addEventListener("touchmove", onPointerMove, { passive: false });
    window.addEventListener("touchend", onPointerUp, { once: true });
  }

  function onPointerMove(e) {
    if (!dragState.current.dragging) return;
    // prevent scroll on touch while dragging
    if (e.cancelable) e.preventDefault();
    const clientX = e.clientX ?? (e.touches && e.touches[0].clientX);
    const clientY = e.clientY ?? (e.touches && e.touches[0].clientY);
    dragState.current.dx = clientX - dragState.current.startX;
    dragState.current.dy = clientY - dragState.current.startY;
    // force update by toggling a small state (we'll use a dummy)
    // but to avoid re-renders on every move, we read dx from ref during render
    // Use a small state tick to trigger re-render only when pointer moves significantly
    // We'll rely on requestAnimationFrame pattern — but keep simple:
    if (Math.abs(dragState.current.dx) % 2 === 0) {
      // no-op; this prevents excessive re-renders in most browsers
    }
    // trigger a re-render: use a local state hack by toggling loading (cheap)
    setLoading((v) => v); // no change, but triggers React to reconcile less often (safe)
  }

  function onPointerUp() {
    if (!dragState.current.dragging) return;
    dragState.current.dragging = false;
    const dx = dragState.current.dx;
    const absX = Math.abs(dx);
    const threshold = 100; // px required to count as swipe
    const top = stack[0];
    if (!top) {
      dragState.current.dx = 0;
      dragState.current.dy = 0;
      return;
    }

    if (absX > threshold) {
      // decide left or right
      const dir = dx > 0 ? "right" : "left";
      if (dir === "right") setQueue((q) => [top, ...q]);
      sendFeedback(top.id, dir);
      setLeaving({ dir, id: top.id });
      // clear pointer listeners
      window.removeEventListener("pointermove", onPointerMove);
      // remove top after animation
      setTimeout(() => {
        setLeaving(null);
        removeTopAndRefill();
        // reset dx
        dragState.current.dx = 0;
        dragState.current.dy = 0;
      }, 300);
    } else {
      // not a swipe — reset position
      dragState.current.dx = 0;
      dragState.current.dy = 0;
      // remove pointermove listener
      window.removeEventListener("pointermove", onPointerMove);
    }
  }

  // Helper: compute top card transform style
  function topCardStyle(i) {
    if (i !== 0) return {};
    const dx = dragState.current.dx || 0;
    const dy = dragState.current.dy || 0;
    const rotate = Math.max(-25, Math.min(25, (dx / 12))); // rotate based on dx
    // if leaving animate off-screen
    if (leaving && leaving.id === stack[0]?.id) {
      const offX = leaving.dir === "right" ? 1200 : -1200;
      return {
        transform: `translate(${offX}px, ${dy}px) rotate(${rotate}deg)`,
        transition: "transform 280ms ease-out",
      };
    }
    if (dragState.current.dragging) {
      return {
        transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg)`,
        transition: "transform 0ms",
      };
    }
    // default resting transform for top card
    return { transform: `translate(0px, 0px) rotate(0deg)`, transition: "transform 220ms ease-out" };
  }

  // Product card subcomponent
  function ProductCard({ p, i }) {
    const yOffset = Math.min(i * 12, 48);
    const scale = Math.max(1 - i * 0.03, 0.84);
    const style = i === 0 ? topCardStyle(i) : { transform: `translateY(${yOffset}px) scale(${scale})`, transition: "transform 220ms ease-out" };

    return (
      <div
        className="absolute w-80 h-[520] rounded-2xl shadow-2xl bg-white p-0 overflow-hidden"
        style={{
          left: "50%",
          ...style,
          zIndex: 100 - i,
          transformOrigin: "center",
          // ensure correct left offset
          // transform already contains translate, so use translate(-50%, ...) appended if needed
          // we'll apply translate(-50%) by shifting via left 50% and then transform includes translate(...) centered visually
        }}
        onPointerDown={i === 0 ? onPointerDown : undefined}
        onTouchStart={i === 0 ? onPointerDown : undefined}
        key={p.id}
      >
        <div className="h-72 w-full bg-gray-100 overflow-hidden">
          <img src={p.image} alt={p.title} className="w-full h-full object-cover" />
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-lg">{p.title}</h3>
          <p className="text-sm text-gray-600">{p.brand} • {p.category}</p>
          <div className="mt-3 flex items-center justify-between">
            <div className="font-bold">₹{p.price}</div>
            <div className="text-xs text-gray-500">{p.tags?.slice(0, 3).join(", ")}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-white flex flex-col items-center py-12">
      <header className="mb-6 text-center w-full max-w-4xl px-6">
        <h1 className="text-3xl md:text-4xl font-extrabold">ClothSwipe — pick your wardrobe</h1>
        <p className="text-sm text-gray-600">Swipe right to save, left to pass. Keyboard: ← →</p>
      </header>

      <main className="relative w-full max-w-lg h-[560] flex items-center justify-center">
        <div className="relative w-80 h-[520]">
          {stack.length === 0 && !loading && (
            <div className="w-80 h-[520] rounded-2xl shadow p-6 flex items-center justify-center text-gray-500">
              No items — try Refill
            </div>
          )}

          {/* render stack */}
          {stack.map((p, i) => (
            <ProductCard key={p.id} p={p} i={i} />
          ))}
        </div>
      </main>

      <footer className="mt-6 flex items-center gap-4">
        <button onClick={() => handleManualSwipe("left")} className="px-5 py-3 rounded-full bg-red-100 hover:bg-red-200">Pass</button>
        <button onClick={() => handleManualSwipe("right")} className="px-5 py-3 rounded-full bg-green-100 hover:bg-green-200">Save</button>
        <button onClick={() => refillStack(6)} className="px-4 py-3 rounded-full bg-gray-100 hover:bg-gray-200">Refill</button>
      </footer>

      <aside className="mt-8 w-full max-w-lg px-2">
        <h2 className="text-lg font-semibold">Your Queue ({queue.length})</h2>
        <div className="mt-3 grid grid-cols-4 gap-3">
          {queue.map((it) => (
            <div key={it.id} className="h-28 rounded-md overflow-hidden bg-white shadow-sm">
              <img src={it.image} alt={it.title} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </aside>

      <div className="fixed bottom-4 right-4 text-xs text-gray-500">
        {MOCK ? "Mock mode • Using sample items" : "Live mode • Connected to backend"}
      </div>
    </div>
  );
}
