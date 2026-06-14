#!/usr/bin/env python3
import subprocess
import os
import tempfile
import shutil

INPUT = "/Users/ruanyf/del-202606/demo.jpg"
OUTPUT = "/Users/ruanyf/del-202606/demo.jpg"
TARGET = 120 * 1024  # 120 KB

def run_sips(max_dim, quality, output_path):
    """Resize image with sips, return output size in bytes."""
    cmd = [
        "sips",
        "-Z", str(max_dim),
        "-s", "formatOptions", str(quality),
        INPUT,
        "--out", output_path,
    ]
    subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    return os.path.getsize(output_path)

def find_best():
    tmp_dir = tempfile.mkdtemp()
    tmp_path = os.path.join(tmp_dir, "demo_resized.jpg")
    
    try:
        # Step 1: binary search max dimension at quality 85
        lo, hi = 100, 6629
        best_dim = 100
        while lo <= hi:
            mid = (lo + hi) // 2
            size = run_sips(mid, 85, tmp_path)
            if size < TARGET:
                best_dim = mid
                lo = mid + 1
            else:
                hi = mid - 1
        
        print(f"Max dimension at quality 85: {best_dim}px, size check...")
        
        # Step 2: at best_dim, increase quality as much as possible
        best_quality = 85
        for q in range(86, 96):
            size = run_sips(best_dim, q, tmp_path)
            if size < TARGET:
                best_quality = q
            else:
                break
        
        # Final result
        final_size = run_sips(best_dim, best_quality, tmp_path)
        print(f"Best settings: max dim={best_dim}px, quality={best_quality}, size={final_size} bytes ({final_size/1024:.2f} KB)")
        
        # Copy to output
        shutil.copy(tmp_path, OUTPUT)
        print(f"Saved to {OUTPUT}")
        
    finally:
        shutil.rmtree(tmp_dir)

if __name__ == "__main__":
    find_best()
