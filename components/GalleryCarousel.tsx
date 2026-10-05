'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './GalleryCarousel.module.css';

interface Props {
    intervalMs?: number;
    className?: string;
    images?: string[];
    /** how the image should be fit into the box: 'cover' | 'contain' | 'fill' */
    objectFit?: 'cover' | 'contain' | 'fill';
    /** ordering mode: random (default) or ordered */
    mode?: 'random' | 'ordered';
}

const defaultImages: string[] = [];

function getRandomIndex(length: number, exclude: number) {
    if (length <= 1) return 0;
    let next = Math.floor(Math.random() * length);
    if (next === exclude) next = (next + 1) % length;
    return next;
}

export default function GalleryCarousel({ intervalMs = 8000, className = '', images: imagesProp, objectFit = 'contain', mode = 'random' }: Props) {
    const images = useMemo(() => imagesProp ?? defaultImages, [imagesProp]);
    const FADE_MS = 2000; // fade duration
    const imagesKey = JSON.stringify(images);
    const [slideState, setSlideState] = useState({ imagesKey, index: 0, visible: true });
    const slide = slideState.imagesKey === imagesKey ? slideState : { imagesKey, index: 0, visible: true };
    const { index, visible } = slide;
    const intervalRef = useRef<number | null>(null);
    const timeoutRef = useRef<number | null>(null);
    const indexRef = useRef<number>(0);

    const getNextIndex = useCallback(
        (current: number) => {
            if (images.length <= 1) return 0;
            if (mode === 'ordered') return (current + 1) % images.length;
            return getRandomIndex(images.length, current);
        },
        [images, mode]
    );

    const updateSlide = useCallback((update: (current: typeof slide) => typeof slide) => {
        setSlideState((previous) => update(previous.imagesKey === imagesKey ? previous : { imagesKey, index: 0, visible: true }));
    }, [imagesKey]);

    useEffect(() => {
        if (!images.length) return;
        // start initial interval
        intervalRef.current = window.setInterval(() => {
            // compute next randomly (avoid immediate repeat) and preload it
            const current = indexRef.current;
            const next = getNextIndex(current);
            const preload = document.createElement('img');
            preload.src = images[next];

            // start fade out
            updateSlide((currentSlide) => ({ ...currentSlide, visible: false }));

            // after fade duration, swap image and fade in
            timeoutRef.current = window.setTimeout(() => {
                updateSlide((currentSlide) => ({ ...currentSlide, index: next, visible: true }));
            }, FADE_MS);
        }, intervalMs);

        return () => {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
        };
    }, [intervalMs, images, getNextIndex, updateSlide]);

    // preload next image whenever index changes
    useEffect(() => {
        if (!images.length) return;
        const next = (index + 1) % images.length;
        const preload = document.createElement('img');
        preload.src = images[next];
        indexRef.current = index;
    }, [index, images]);

    const fitClass = objectFit === 'contain' ? styles.fitContain : objectFit === 'fill' ? styles.fitFill : styles.fitCover;
    const imageClassName = [styles.image, fitClass, visible ? styles.visible : ''].filter(Boolean).join(' ');

    return (
        <div
            className={[styles.carousel, className].filter(Boolean).join(' ')}
        >
            {images.length ? (
                // Use a plain <img> to support remote URLs (e.g. Supabase public URLs) without Next image domain config.
                <img
                    src={images[index]}
                    alt={`Gallery ${index + 1}`}
                    className={imageClassName}
                    loading="lazy"
                />
            ) : null}
        </div>
    );
}
