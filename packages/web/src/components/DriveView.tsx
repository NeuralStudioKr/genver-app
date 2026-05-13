'use client';

import { useState, useEffect, useRef } from 'react';
import { api, type DriveFile } from '@/lib/api';

export default function DriveView() {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getDriveFiles()
      .then(setFiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const uploaded = await api.uploadFile(formData);
      setFiles((prev) => [uploaded, ...prev]);
    } catch {
      // upload failed
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      // delete failed
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="h-14 border-b border-gray-200 flex items-center px-4 gap-3 bg-white flex-shrink-0">
        <h2 className="font-semibold text-gray-900 text-base">📁 Drive</h2>
        <div className="ml-auto">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`btn-primary cursor-pointer inline-block text-sm ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="text-gray-400 text-sm">Loading files...</p>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-4xl mb-3">📂</p>
            <p className="text-sm">No files yet. Upload something!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
              >
                <span className="text-2xl">📄</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">
                    {formatSize(file.size)} · {new Date(file.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={api.downloadFileUrl(file.id)}
                    className="text-xs text-accent hover:text-accent-hover"
                  >
                    Download
                  </a>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
