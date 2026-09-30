-- ============================================================================
-- Migration v102: Seed & Publish Release v1.0.2 (Commercial Release)
-- ============================================================================

INSERT INTO public.release_versions (
  version,
  min_supported_version,
  is_force_update,
  rollout_percentage,
  release_notes,
  download_url
)
VALUES (
  '1.0.2',
  '1.0.0',
  false,
  100,
  'Bản phát hành v1.0.2:
- Tối ưu chỉnh sửa từng mục trên Panel: Sửa mục nào chỉ điền đúng mục đó vào trang bưu điện (Surgical Single-Field Sync), không chạy lại toàn bộ đơn.
- Tra Cứu Đơn Hàng Toàn Cục (Global Orders Explorer): Sắp xếp đơn mới nhất lên đầu, bảo vệ dữ liệu cá nhân PII khách hàng theo nguyên tắc cô lập đa người thuê.
- Nâng cấp độ ổn định đồng bộ dữ liệu đa máy trạm.',
  'AutoFillOrder-v1.0.2.zip'
)
ON CONFLICT (version) DO UPDATE SET
  min_supported_version = EXCLUDED.min_supported_version,
  is_force_update = EXCLUDED.is_force_update,
  rollout_percentage = EXCLUDED.rollout_percentage,
  release_notes = EXCLUDED.release_notes,
  download_url = COALESCE(EXCLUDED.download_url, public.release_versions.download_url);
