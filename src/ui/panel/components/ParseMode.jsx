import React, { useState, useEffect, useRef } from 'react';
import { Zap, ClipboardPaste, Trash2, Image, Upload, Eye, X, Camera } from 'lucide-react';

export default function ParseMode({ onParse, onParseImage, isLoading, progressStatus }) {
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showZoom, setShowZoom] = useState(false);
  const fileInputRef = useRef(null);
  const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
  const SUPPORTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);

  // Xử lý khi dán từ clipboard (hỗ trợ cả text và ảnh)
  const handlePasteEvent = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          readAndSetImage(file);
          return;
        }
      }
    }
  };

  const readAndSetImage = (file) => {
    if (!file || !SUPPORTED_IMAGE_TYPES.has(file.type)) return;
    if (file.size > MAX_IMAGE_BYTES) {
      console.warn('[ParseMode] Image is too large; max 6MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result;
      if (base64) {
        setImagePreview(base64);
        setText(''); // Ưu tiên ảnh khi vừa dán/thả ảnh
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handleGlobalKeyDown = async (e) => {
      // Ctrl+Shift+V để đọc clipboard nhanh
      if (e.ctrlKey && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        try {
          // Thử đọc ảnh từ navigator.clipboard.read()
          if (navigator.clipboard && navigator.clipboard.read) {
            const clipItems = await navigator.clipboard.read();
            for (const item of clipItems) {
              const imageType = item.types.find(t => t.startsWith('image/'));
              if (imageType) {
                const blob = await item.getType(imageType);
                readAndSetImage(blob);
                return;
              }
            }
          }
          const clipboardText = await navigator.clipboard.readText();
          if (clipboardText && clipboardText.trim()) {
            setText(clipboardText);
            setImagePreview(null);
            onParse(clipboardText);
          }
        } catch (err) {
          console.warn("Không thể đọc clipboard tự động:", err);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onParse]);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files && e.dataTransfer.files[0]) {
      readAndSetImage(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      readAndSetImage(e.target.files[0]);
    }
  };

  const handleTriggerAction = () => {
    if (imagePreview && onParseImage) {
      onParseImage(imagePreview);
    } else if (text.trim()) {
      onParse(text);
    }
  };

  return (
    <div 
      className="af-panel-content"
      onPaste={handlePasteEvent}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Ẩn file input để kích hoạt khi click chọn ảnh */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileInputChange} 
        accept="image/*" 
        style={{ display: 'none' }} 
      />

      {/* Hiển thị tiến trình trực quan nếu đang xử lý */}
      {isLoading && progressStatus && (
        <div className="af-vision-status">
          <div className="af-spin" style={{ width: '14px', height: '14px', border: '2px solid #166534', borderTopColor: 'transparent', borderRadius: '50%' }}></div>
          <span>{progressStatus.message || 'Đang xử lý...'}</span>
        </div>
      )}

      {/* KHUNG HIỂN THỊ ẢNH ĐÃ DÁN / CHỌN */}
      {imagePreview ? (
        <div className="af-image-preview-container">
          <div className="af-image-preview-badge">
            <Camera size={11} /> ẢNH ĐƠN HÀNG
          </div>
          <button 
            className="af-image-preview-remove" 
            onClick={() => setImagePreview(null)}
            title="Xóa ảnh"
            disabled={isLoading}
          >
            <X size={12} />
          </button>
          <img 
            src={imagePreview} 
            alt="Preview đơn hàng" 
            className="af-image-preview-img"
            onClick={() => setShowZoom(true)}
            title="Bấm để xem ảnh phóng to"
          />
        </div>
      ) : (
        /* KHUNG NHẬP TEXT HOẶC DÁN ẢNH */
        <div style={{ position: 'relative' }}>
          <textarea 
            placeholder="Dán văn bản hoặc nhấn Ctrl+V dán ẢNH vào đây...&#10;(Ctrl+Enter để tách nhanh)"
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                if (text.trim() && !isLoading) onParse(text);
              }
            }}
          />
          {isDragging && (
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(219, 234, 254, 0.9)',
              border: '2px dashed #3b82f6',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1d4ed8',
              fontWeight: 600,
              fontSize: '12px',
              gap: '6px'
            }}>
              <Upload size={16} /> Thả ảnh đơn hàng vào đây
            </div>
          )}
        </div>
      )}

      {/* HÀNG NÚT ĐIỀU KHIỂN */}
      <div style={{ display: 'grid', gridTemplateColumns: imagePreview ? '1fr 80px' : '1fr 70px 60px', gap: '8px' }}>
        <button 
          className="af-btn-primary" 
          onClick={handleTriggerAction}
          disabled={(!text.trim() && !imagePreview) || isLoading}
          style={imagePreview ? { background: '#059669', color: 'white' } : {}}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}>
            {imagePreview ? <Camera size={14} /> : <Zap size={14} />}
          </span>
          {imagePreview ? 'Tách Từ Ảnh' : 'Tách Đơn'}
        </button>

        {!imagePreview && (
          <button 
            className="af-btn-primary" 
            style={{ background: '#3b82f6' }}
            onClick={async () => {
              try {
                if (navigator.clipboard && navigator.clipboard.read) {
                  const clipItems = await navigator.clipboard.read().catch(() => []);
                  for (const item of clipItems) {
                    const imgType = item.types.find(t => t.startsWith('image/'));
                    if (imgType) {
                      const blob = await item.getType(imgType);
                      readAndSetImage(blob);
                      return;
                    }
                  }
                }
                const clipText = await navigator.clipboard.readText();
                if (clipText) setText(clipText);
              } catch (err) {
                console.warn("Lỗi dán:", err);
                if (fileInputRef.current) fileInputRef.current.click();
              }
            }}
            disabled={isLoading}
            title="Dán từ bộ nhớ tạm"
          >
            <span style={{ display: 'inline-flex', alignItems: 'center' }}><ClipboardPaste size={14} /></span> Dán
          </button>
        )}

        <button 
          className="af-btn-delete" 
          onClick={() => {
            setText('');
            setImagePreview(null);
          }}
          disabled={isLoading || (!text && !imagePreview)}
          title="Xóa nội dung"
        >
          <span style={{ display: 'inline-flex', alignItems: 'center' }}><Trash2 size={14} /></span>
          Xóa
        </button>
      </div>

      {/* Nút phụ: Tải ảnh từ máy / Chụp ảnh */}
      {!imagePreview && (
        <div 
          className="af-image-dropzone"
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Image size={14} color="#3b82f6" />
            <span className="af-image-dropzone-text">Chọn hoặc Kéo thả ảnh đơn hàng vào đây</span>
          </div>
          <span className="af-image-dropzone-sub">(Hỗ trợ ảnh Zalo, Messenger, bill in nhiệt, chữ viết tay)</span>
        </div>
      )}

      {/* MODAL XEM ẢNH PHÓNG TO */}
      {showZoom && imagePreview && (
        <div className="af-image-modal-backdrop" onClick={() => setShowZoom(false)}>
          <div className="af-image-modal-content" onClick={e => e.stopPropagation()}>
            <button className="af-image-modal-close" onClick={() => setShowZoom(false)}>
              <X size={16} />
            </button>
            <img src={imagePreview} alt="Phóng to ảnh đơn hàng" className="af-image-modal-img" />
          </div>
        </div>
      )}
    </div>
  );
}
