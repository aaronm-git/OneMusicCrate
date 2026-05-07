"use client";

import { AlbumIcon, Loader2Icon, MoreVerticalIcon, PauseIcon, PlayIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MusicTrackView } from "@/lib/music-services";
import { cn } from "@/lib/utils";

export type TrackTableColumn<T> = {
  id: string;
  header: ReactNode;
  widthClassName?: string;
  headClassName?: string;
  cellClassName?: string;
  render: (item: T, index: number) => ReactNode;
};

export type TrackTableMenuAction<T> = {
  icon?: LucideIcon;
  label: ReactNode | ((item: T, index: number) => ReactNode);
  onSelect: (item: T, index: number) => void;
  disabled?: boolean | ((item: T, index: number) => boolean);
  variant?: "default" | "destructive";
};

type TrackTableProps<T> = {
  items: T[];
  columns: TrackTableColumn<T>[];
  getItemKey: (item: T, index: number) => string;
  menuActions?: TrackTableMenuAction<T>[];
  actionColumnLabel?: string;
  actionColumnWidthClassName?: string;
  stickyHeader?: boolean;
  stickyActionColumn?: boolean;
  isActionMenuBusy?: (item: T, index: number) => boolean;
  isActionMenuDisabled?: (item: T, index: number) => boolean;
};

type TrackTableTrackCellProps = {
  track: MusicTrackView;
  subtitle: ReactNode;
  coverSize?: number;
  playback?: {
    disabled?: boolean;
    isBusy?: boolean;
    isCurrent?: boolean;
    isPlaying?: boolean;
    onToggle: () => void;
  };
};

function resolveNode<T>(
  value: ReactNode | ((item: T, index: number) => ReactNode),
  item: T,
  index: number
) {
  return typeof value === "function"
    ? (value as (item: T, index: number) => ReactNode)(item, index)
    : value;
}

function resolveBoolean<T>(
  value: boolean | ((item: T, index: number) => boolean) | undefined,
  item: T,
  index: number
) {
  return typeof value === "function"
    ? value(item, index)
    : Boolean(value);
}

function TrackArtwork({ track, size }: { track: MusicTrackView; size: number }) {
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-md bg-muted"
      style={{ height: size, width: size }}
    >
      {track.images[0]?.url ? (
        <Image
          alt={track.album}
          className="object-cover"
          fill
          sizes={`${size}px`}
          src={track.images[0].url}
        />
      ) : (
        <AlbumIcon className="absolute inset-0 m-auto size-4 text-muted-foreground" />
      )}
    </div>
  );
}

export function TrackTableTrackCell({
  track,
  subtitle,
  coverSize = 44,
  playback,
}: TrackTableTrackCellProps) {
  const showPlaybackButton = Boolean(playback && !playback.disabled);
  const isCurrent = Boolean(playback?.isCurrent);
  const isPlaying = Boolean(playback?.isPlaying);
  const isBusy = Boolean(playback?.isBusy);

  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative shrink-0">
        <TrackArtwork size={coverSize} track={track} />
        {showPlaybackButton ? (
          <Button
            aria-label={isCurrent && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
            className={cn(
              "absolute inset-0 m-auto size-8 rounded-full border border-white/10 bg-black/70 text-white shadow-lg backdrop-blur-sm transition-opacity hover:bg-black/80",
              "opacity-0 group-hover/track-row:opacity-100 focus-visible:opacity-100",
              (isCurrent && isPlaying) || isBusy ? "opacity-100" : null
            )}
            disabled={isBusy}
            onClick={playback?.onToggle}
            size="icon-sm"
            variant="ghost"
          >
            {isBusy ? (
              <Loader2Icon className="animate-spin" />
            ) : isCurrent && isPlaying ? (
              <PauseIcon className="fill-current" />
            ) : (
              <PlayIcon className="fill-current" />
            )}
          </Button>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{track.title}</p>
        <div className="truncate text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

export function TrackTable<T>({
  items,
  columns,
  getItemKey,
  menuActions = [],
  actionColumnLabel = "Options",
  actionColumnWidthClassName = "w-14",
  stickyHeader = false,
  stickyActionColumn = true,
  isActionMenuBusy,
  isActionMenuDisabled,
}: TrackTableProps<T>) {
  const hasMenu = menuActions.length > 0;

  return (
    <Table className="table-fixed">
      <colgroup>
        {columns.map((column) => (
          <col className={column.widthClassName} key={column.id} />
        ))}
        {hasMenu ? <col className={actionColumnWidthClassName} /> : null}
      </colgroup>
      <TableHeader className={cn(stickyHeader ? "sticky top-0 z-20 bg-card/90 backdrop-blur-md" : null)}>
        <TableRow>
          {columns.map((column) => (
            <TableHead className={column.headClassName} key={column.id}>
              {column.header}
            </TableHead>
          ))}
          {hasMenu ? (
            <TableHead
              className={cn(
                "text-right",
                stickyActionColumn ? "sticky right-0 z-30 bg-card/95 backdrop-blur-md" : null
              )}
            >
              <span className="sr-only">{actionColumnLabel}</span>
            </TableHead>
          ) : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => {
          const menuBusy = isActionMenuBusy?.(item, index) ?? false;
          const menuDisabled = isActionMenuDisabled?.(item, index) ?? false;

          return (
            <TableRow className="group/track-row" key={getItemKey(item, index)}>
              {columns.map((column) => (
                <TableCell className={column.cellClassName} key={column.id}>
                  {column.render(item, index)}
                </TableCell>
              ))}
              {hasMenu ? (
                <TableCell
                  className={cn(
                    "pr-3",
                    stickyActionColumn
                      ? "sticky right-0 z-10 bg-card/95 transition-colors group-hover/track-row:bg-muted/50"
                      : null
                  )}
                >
                  <div className="flex justify-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            aria-label={actionColumnLabel}
                            disabled={menuBusy || menuDisabled}
                            size="icon-sm"
                            variant="ghost"
                          />
                        }
                      >
                        {menuBusy ? <Loader2Icon className="animate-spin" /> : <MoreVerticalIcon />}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        {menuActions.map((action) => {
                          const Icon = action.icon;
                          const disabled = resolveBoolean(action.disabled, item, index);

                          return (
                            <DropdownMenuItem
                              disabled={disabled}
                              key={`${getItemKey(item, index)}-${String(action.label)}`}
                              onClick={() => action.onSelect(item, index)}
                              variant={action.variant}
                            >
                              {Icon ? <Icon /> : null}
                              {resolveNode(action.label, item, index)}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              ) : null}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
