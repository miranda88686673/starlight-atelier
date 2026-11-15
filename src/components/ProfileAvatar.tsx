import React from 'react';
import {
  AvatarDisplayMode,
  AvatarGender,
  EquippedOutfit,
  SkinToneId,
} from '../types/game';
import { MeDollSvg } from './svg/MeDollSvg';

interface ProfileAvatarProps {
  username: string;
  equipped: EquippedOutfit;
  skinTone: SkinToneId;
  avatarGender: AvatarGender;
  profilePic?: string;
  customAvatarUrl?: string;
  avatarDisplayMode?: AvatarDisplayMode;
  deletedItemIds?: string[];
  sizeClass?: string;
  roundedClass?: string;
}

/**
 * Componente unificado de Foto Oficial de Perfil.
 * - Exibe a foto enviada do PC quando houver `profilePic` (ou `customAvatarUrl`) e modo photo.
 * - Caso contrário, renderiza o retrato ao vivo da MeDoll.
 */
export const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  username,
  equipped,
  skinTone,
  avatarGender,
  profilePic,
  customAvatarUrl,
  avatarDisplayMode = 'medoll',
  deletedItemIds = [],
  sizeClass = 'w-10 h-10',
  roundedClass = 'rounded-full',
}) => {
  const activePic = profilePic || customAvatarUrl;
  const useCustomPhoto = (avatarDisplayMode === 'photo' || Boolean(activePic)) && Boolean(activePic);

  if (useCustomPhoto && activePic) {
    return (
      <div
        className={`${sizeClass} ${roundedClass} overflow-hidden border border-[#E6E0D8] bg-[#FAF8F5] shrink-0`}
      >
        <img
          src={activePic}
          alt={`Foto de perfil de ${username}`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className={`${sizeClass} ${roundedClass} overflow-hidden border border-[#E6E0D8] bg-[#FAF8F5] shrink-0 relative flex items-center justify-center`}
    >
      <div
        className="w-[82%] h-[82%] rounded-t-full bg-[#F2E9DF]/80 absolute bottom-0"
        aria-hidden="true"
      />
      <svg
        viewBox="68 20 144 166"
        className="w-full h-full relative z-10"
        role="img"
        aria-label={`Avatar MeDoll de ${username}`}
      >
        <MeDollSvg
          equipped={equipped}
          skinTone={skinTone}
          avatarGender={avatarGender}
          deletedItemIds={deletedItemIds}
        />
      </svg>
    </div>
  );
};
