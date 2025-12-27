#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
测试结果文件内容
"""

import pandas as pd
import os

# 读取生成的Excel文件
excel_file = "results/up_core_views.xlsx"

if os.path.exists(excel_file):
    print(f"\n成功读取结果文件: {excel_file}")
    df = pd.read_excel(excel_file)
    print(f"\n文件内容:\n{df}")
else:
    print(f"\n结果文件不存在: {excel_file}")
    
# 检查是否生成了其他文件
print(f"\n结果目录内容: {os.listdir('results')}")