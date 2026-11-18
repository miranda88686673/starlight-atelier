import React, { useEffect, useState } from 'react';
import type {
  AvatarGender,
  ClothingItem,
  FurnitureDef,
  PurchasableWallpaperItem,
  RoomBackdropTheme,
} from '../../types/game';
import {
  getCachedThumbnail,
  requestClothingThumbnail,
  requestFurnitureThumbnail,
  requestRoomStageThumbnail,
} from '../../three/thumbnailCache';

interface ThreeClothingThumbProps {
  item: ClothingItem;
  genderHint?: AvatarGender;
  className?: string;
}

export const ThreeClothingThumbnail: React.FC<ThreeClothingThumbProps> = ({
  item,
  genderHint = 'feminino',
  className = 'w-full h-full object-contain',
}) => {
  const effectiveGender: AvatarGender = item.gender === 'unissex' ? genderHint : item.gender;
  const cacheKey = `cloth_${item.id}_${item.swatchColor}_${effectiveGender}`;
  const [url, setUrl] = useState<string | undefined>(() =>
    item.thumbnail_url || item.customLayerPngUrl || getCachedThumbnail(cacheKey)
  );

  useEffect(() => {
    if (item.thumbnail_url || item.customLayerPngUrl) {
      setUrl(item.thumbnail_url || item.customLayerPngUrl);
      return;
    }
    const cached = getCachedThumbnail(cacheKey);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(undefined);
    const cancel = requestClothingThumbnail(item, effectiveGender, (dataUrl) => {
      setUrl(dataUrl);
    });
    return cancel;
  }, [item, effectiveGender, cacheKey]);

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-8 h-8 rounded-full border-2 border-white/80 shadow-inner"
          style={{ backgroundColor: item.swatchColor || '#D4AF37' }}
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={item.name}
      className={className}
      draggable={false}
    />
  );
};

interface ThreeFurnitureThumbProps {
  def: FurnitureDef;
  className?: string;
}

export const ThreeFurnitureThumbnail: React.FC<ThreeFurnitureThumbProps> = ({
  def,
  className = 'w-full h-full object-contain',
}) => {
  const cacheKey = `furn_${def.id}_${def.swatchColor || ''}`;
  const [url, setUrl] = useState<string | undefined>(() => getCachedThumbnail(cacheKey));

  useEffect(() => {
    const cached = getCachedThumbnail(cacheKey);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(undefined);
    const cancel = requestFurnitureThumbnail(def, (dataUrl) => {
      setUrl(dataUrl);
    });
    return cancel;
  }, [def, cacheKey]);

  if (!url) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div
          className="w-10 h-7 rounded-lg border border-black/10 shadow-inner"
          style={{ backgroundColor: def.swatchColor || '#8C5230' }}
        />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={def.name}
      className={className}
      draggable={false}
    />
  );
};

interface ThreeRoomThumbProps {
  theme: RoomBackdropTheme;
  wallpaper?: PurchasableWallpaperItem;
  alt?: string;
  className?: string;
}

export const ThreeRoomThumbnail: React.FC<ThreeRoomThumbProps> = ({
  theme,
  wallpaper,
  alt = 'Prévia de sala 3D',
  className = 'w-full h-full object-cover',
}) => {
  const cacheKey = `room_${theme}_${wallpaper?.id || 'base'}`;
  const [url, setUrl] = useState<string | undefined>(() => getCachedThumbnail(cacheKey));

  useEffect(() => {
    const cached = getCachedThumbnail(cacheKey);
    if (cached) {
      setUrl(cached);
      return;
    }
    setUrl(undefined);
    const cancel = requestRoomStageThumbnail(theme, wallpaper, (dataUrl) => {
      setUrl(dataUrl);
    });
    return cancel;
  }, [theme, wallpaper, cacheKey]);

  if (!url) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-[11px] font-medium text-stone-400"
        style={{ backgroundColor: wallpaper?.wallTopColor ?? '#21192E' }}
      >
        Renderizando 3D...
      </div>
    );
  }

  return <img src={url} alt={alt} className={className} draggable={false} />;
};
