# Patch file for views.py - Add auto-generate book ID functionality

import time
import random

def tao_ma_sach_tu_dong():
    """Tao ma sach tu dong duy nhat"""
    timestamp = str(int(time.time()))[-6:]  # Lay 6 chu so cuoi
    random_num = str(random.randint(100, 999))
    return f"MS{timestamp}{random_num}"
