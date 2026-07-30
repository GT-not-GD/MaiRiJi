import os
from PIL import Image

# 支持处理的图片格式
VALID_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')

def process_image(file_path, max_width=1920, tiny_width=30, quality=85, tiny_quality=30):
    """
    处理单张图片（2K 视网膜高清标准）：
    1. 生成标准超清 .webp (默认最大宽度 1920px，质量 85%)
    2. 生成微缩版 -tiny.webp (默认最大宽度 30px，用于渐进式模糊对焦)
    """
    filename, ext = os.path.splitext(file_path)
    ext_lower = ext.lower()
    
    # 忽略非图片文件或已经是 -tiny 的文件
    if ext_lower not in VALID_EXTENSIONS or filename.endswith('-tiny'):
        return

    output_webp = f"{filename}.webp"
    output_tiny_webp = f"{filename}-tiny.webp"

    try:
        with Image.open(file_path) as img:
            # 保持 PNG/WebP 的透明通道（RGBA），其他转为 RGB
            if img.mode in ('P', 'PA'):
                img = img.convert('RGBA')

            # ----------------------------------------------------
            # 1. 生成 2K 超清版 .webp (最大宽度 1920px，质量 85%)
            # ----------------------------------------------------
            main_img = img.copy()
            if main_img.width > max_width:
                ratio = max_width / float(main_img.width)
                new_height = int(float(main_img.height) * ratio)
                main_img = main_img.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # 保存超清 .webp
            main_img.save(output_webp, 'WEBP', quality=quality)

            # ----------------------------------------------------
            # 2. 生成微缩版 -tiny.webp (用于渐进式模糊对焦)
            # ----------------------------------------------------
            tiny_img = img.copy()
            if tiny_img.width > tiny_width:
                ratio = tiny_width / float(tiny_img.width)
                new_height = int(float(tiny_img.height) * ratio)
                tiny_img = tiny_img.resize((tiny_width, new_height), Image.Resampling.LANCZOS)

            tiny_img.save(output_tiny_webp, 'WEBP', quality=tiny_quality)

            base_name = os.path.basename(file_path)
            print(f"✅ 处理成功: {base_name}")
            print(f"   ├── 超清版 (1920px/85%): {os.path.basename(output_webp)}")
            print(f"   └── 微缩版 (30px): {os.path.basename(output_tiny_webp)}")

    except Exception as e:
        print(f"❌ 处理失败 [{file_path}]: {e}")

def batch_process_folder(folder_path):
    """递归处理文件夹下的所有图片"""
    if not os.path.exists(folder_path):
        print(f"⚠️ 找不到指定的文件夹: {os.path.abspath(folder_path)}")
        return

    print(f"\n🚀 开始处理图片 (2K 超清标准 1920px / 85%): {os.path.abspath(folder_path)}\n" + "-"*60)
    count = 0
    
    for root, dirs, files in os.walk(folder_path):
        for file in files:
            file_path = os.path.join(root, file)
            filename, ext = os.path.splitext(file)
            
            # 只处理有效格式且不带 -tiny 的图片
            if ext.lower() in VALID_EXTENSIONS and not filename.endswith('-tiny'):
                process_image(file_path)
                count += 1

    print("-" * 60)
    print(f"🎉 全部处理完成！共生成了 {count} 组 2K 级别的超清 WebP 图片。\n")

if __name__ == '__main__':
    print("=" * 60)
    print("🍞 麦日记图片自动化转换工具 (2K 高清升级版)")
    print("=" * 60)
    
    input_dir = input("请输入图片文件夹路径 (直接按回车默认处理 'assets/img/convert_images'): ").strip()
    
    if not input_dir:
        input_dir = os.path.join('assets', 'img','convert_images')

    batch_process_folder(input_dir)
