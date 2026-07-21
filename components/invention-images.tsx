"use client";

import { useActionState, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import {
  deleteInventionImage,
  uploadInventionImages,
  type ImageActionState,
} from "@/app/dashboard/inventions/[id]/actions";

const initialState: ImageActionState = {};

export type InventionImage = {
  id: string;
  original_name: string;
  image_type: string;
  file_size: number;
  signedUrl: string;
};

const imageTypes = [
  ["prototype", "Prototype"], ["front_view", "Front view"], ["rear_view", "Rear view"],
  ["internal_view", "Internal view"], ["sketch", "Sketch"], ["other", "Other"],
];

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function DeleteImageButton({ imageId }: { imageId: string }) {
  const [state, action, pending] = useActionState(deleteInventionImage, initialState);
  return <form action={action} className="delete-image-form">
    <input type="hidden" name="image_id" value={imageId} />
    <button type="submit" disabled={pending}>{pending ? "Deleting…" : "Delete"}</button>
    {state.error && <span role="alert">{state.error}</span>}
  </form>;
}

export function InventionImages({ inventionId, images }: { inventionId: string; images: InventionImage[] }) {
  const [state, action, pending] = useActionState(uploadInventionImages, initialState);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [imageType, setImageType] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const wasPendingRef = useRef(false);
  const previews = useMemo(() => selectedFiles.map((file) => URL.createObjectURL(file)), [selectedFiles]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview)), [previews]);

  useEffect(() => {
    if (pending) {
      wasPendingRef.current = true;
      return;
    }

    if (wasPendingRef.current && !state.error) {
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    wasPendingRef.current = false;
  }, [pending, state.error]);

  function updateFiles(files: File[]) {
    setSelectedFiles(files);
    if (!fileInputRef.current) return;

    if (files.length === 0) {
      fileInputRef.current.value = "";
      return;
    }

    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    fileInputRef.current.files = transfer.files;
  }

  function removeSelectedFile(index: number) {
    updateFiles(selectedFiles.filter((_, fileIndex) => fileIndex !== index));
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragActive(false);
    updateFiles(Array.from(event.dataTransfer.files));
  }

  return <section className="images-section">
    <div className="image-upload-card card">
      <div><span className="eyebrow">INVENTION IMAGES</span><h2>Add photos or sketches</h2><p>Upload clear views that help document how the invention is built and used.</p></div>
      <form action={action} className="image-upload-form">
        <input type="hidden" name="invention_id" value={inventionId} />
        <label className={`file-drop${dragActive ? " drag-active" : ""}${selectedFiles.length ? " has-selection" : ""}`} htmlFor="invention-images" onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={handleDrop}><input ref={fileInputRef} id="invention-images" name="images" type="file" accept="image/jpeg,image/png,image/webp" multiple required disabled={pending} onChange={(event) => updateFiles(Array.from(event.currentTarget.files ?? []))} /><span>{dragActive ? "↓" : selectedFiles.length ? "✓" : "＋"}</span><strong>{dragActive ? "Drop images here" : selectedFiles.length ? "Images ready to upload" : "Choose images"}</strong><small>JPG, PNG, or WebP · maximum 10 MB each · up to 10 at once</small></label>
        <label className="image-type-field"><span>Image type</span><select name="image_type" value={imageType} required disabled={pending} onChange={(event) => setImageType(event.target.value)}><option value="" disabled>Select a type</option>{imageTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        {state.error && <div className="image-action-error" role="alert">{state.error}</div>}
        <button className="upload-button" type="submit" disabled={pending || selectedFiles.length === 0 || !imageType}>{pending && <span className="auth-spinner" aria-hidden="true" />}{pending ? "Uploading…" : "Upload images"}</button>
        {selectedFiles.length > 0 && <div className="selected-images" aria-label="Selected images">
          <p aria-live="polite"><strong>{selectedFiles.length}</strong> {selectedFiles.length === 1 ? "file selected" : "files selected"}</p>
          <ul>{selectedFiles.map((file, index) => <li key={`${file.name}-${file.lastModified}-${index}`}>
            {/* Browser-created local preview URL; it is never sent separately. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previews[index]} alt={`Preview of ${file.name}`} />
            <span><strong title={file.name}>{file.name}</strong><small>{formatBytes(file.size)}</small></span>
            <button type="button" disabled={pending} onClick={() => removeSelectedFile(index)} aria-label={`Remove ${file.name} from selected images`}>Remove</button>
          </li>)}</ul>
        </div>}
      </form>
    </div>

    <div className="gallery-heading"><div><h2>Uploaded images</h2><p>{images.length} {images.length === 1 ? "image" : "images"}</p></div></div>
    {images.length === 0 ? <div className="image-empty"><span>▧</span><strong>No images uploaded</strong><p>Add prototype photos, views, or sketches above.</p></div> : <div className="image-gallery">
      {images.map((image) => <article className="image-card" key={image.id}>
        {/* Signed, short-lived URLs are generated after ownership verification. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image.signedUrl} alt={`${imageTypes.find(([value]) => value === image.image_type)?.[1] ?? "Invention"}: ${image.original_name}`} />
        <div className="image-card-details"><span>{imageTypes.find(([value]) => value === image.image_type)?.[1] ?? "Other"}</span><strong title={image.original_name}>{image.original_name}</strong><small>{formatBytes(image.file_size)}</small><DeleteImageButton imageId={image.id} /></div>
      </article>)}
    </div>}
  </section>;
}
