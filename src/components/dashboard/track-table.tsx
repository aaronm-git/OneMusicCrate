"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlbumIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react";
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

const DEFAULT_ACTION_COLUMN_WIDTH = "3.5rem";
const DEFAULT_OVERSCAN = 10;
const FALLBACK_GRID_WIDTH = "minmax(0, 1fr)";
const TABLE_HEADER_CELL_CLASS =
  "min-w-0 px-2 text-left font-medium whitespace-nowrap text-foreground";
const TABLE_HEADER_GRID_CELL_CLASS = `${TABLE_HEADER_CELL_CLASS} flex h-10 items-center`;
const TABLE_BODY_CELL_CLASS = "min-w-0 p-2 whitespace-nowrap";
const TABLE_ROW_CLASS =
  "box-border border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted";

export type TrackTableColumn<T> = {
  id: string;
  header: ReactNode;
  headerTitle?: string;
  width?: string;
  headClassName?: string;
  cellClassName?: string;
  title?: string | ((item: T, index: number) => string | undefined);
  render: (item: T, index: number) => ReactNode;
};

export type TrackTableMenuAction<T> = {
  icon?: LucideIcon;
  label: ReactNode | ((item: T, index: number) => ReactNode);
  onSelect: (item: T, index: number) => void;
  disabled?: boolean | ((item: T, index: number) => boolean);
  variant?: "default" | "destructive";
};

type TrackTableVirtualizationConfig = {
  rowHeight: number;
  overscan?: number;
  bodyHeightClassName: string;
};

type TrackTableProps<T> = {
  items: T[];
  columns: TrackTableColumn<T>[];
  getItemKey: (item: T, index: number) => string;
  menuActions?: TrackTableMenuAction<T>[];
  actionColumnLabel?: string;
  actionColumnWidth?: string;
  stickyHeader?: boolean;
  stickyActionColumn?: boolean;
  isActionMenuBusy?: (item: T, index: number) => boolean;
  isActionMenuDisabled?: (item: T, index: number) => boolean;
  virtualization?: TrackTableVirtualizationConfig;
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

type TrackTableActionMenuProps<T> = {
  actionColumnLabel: string;
  getItemKey: (item: T, index: number) => string;
  index: number;
  item: T;
  menuActions: TrackTableMenuAction<T>[];
  menuBusy: boolean;
  menuDisabled: boolean;
};

type TrackTableSharedProps<T> = Omit<
  TrackTableProps<T>,
  "virtualization"
> & {
  actionColumnLabel: string;
  actionColumnWidth: string;
  hasMenu: boolean;
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
  return typeof value === "function" ? value(item, index) : Boolean(value);
}

function resolveTitle<T>(
  value: string | ((item: T, index: number) => string | undefined) | undefined,
  item: T,
  index: number
) {
  return typeof value === "function" ? value(item, index) : value;
}

function getGridTemplateColumns<T>(
  columns: TrackTableColumn<T>[],
  hasMenu: boolean,
  actionColumnWidth: string
) {
  const sizes = columns.map((column) => column.width ?? FALLBACK_GRID_WIDTH);

  if (hasMenu) {
    sizes.push(actionColumnWidth);
  }

  return sizes.join(" ");
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

function TrackTableActionMenu<T>({
  actionColumnLabel,
  getItemKey,
  index,
  item,
  menuActions,
  menuBusy,
  menuDisabled,
}: TrackTableActionMenuProps<T>) {
  return (
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

function StandardTrackTable<T>({
  actionColumnLabel,
  actionColumnWidth = DEFAULT_ACTION_COLUMN_WIDTH,
  columns,
  getItemKey,
  hasMenu,
  isActionMenuBusy,
  isActionMenuDisabled,
  items,
  menuActions = [],
  stickyActionColumn = true,
  stickyHeader = false,
}: TrackTableSharedProps<T>) {
  return (
    <Table className="min-w-full w-max table-fixed lg:w-full">
      <colgroup>
        {columns.map((column) => (
          <col key={column.id} style={column.width ? { width: column.width } : undefined} />
        ))}
        {hasMenu ? <col style={{ width: actionColumnWidth }} /> : null}
      </colgroup>
      <TableHeader
        className={cn(
          stickyHeader ? "sticky top-0 z-20 bg-card/90 backdrop-blur-md" : null
        )}
      >
        <TableRow>
          {columns.map((column) => (
            <TableHead
              className={column.headClassName}
              key={column.id}
              title={column.headerTitle}
            >
              {column.header}
            </TableHead>
          ))}
          {hasMenu ? (
            <TableHead
              className={cn(
                "text-right",
                stickyActionColumn ? "sticky right-0 z-30 bg-card" : null
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
                <TableCell
                  className={column.cellClassName}
                  key={column.id}
                  title={resolveTitle(column.title, item, index)}
                >
                  {column.render(item, index)}
                </TableCell>
              ))}
              {hasMenu ? (
                <TableCell
                  className={cn(
                    "pr-3",
                    stickyActionColumn
                      ? "sticky right-0 z-10 bg-card transition-colors group-hover/track-row:bg-muted"
                      : null
                  )}
                >
                  <div className="flex justify-end">
                    <TrackTableActionMenu
                      actionColumnLabel={actionColumnLabel}
                      getItemKey={getItemKey}
                      index={index}
                      item={item}
                      menuActions={menuActions}
                      menuBusy={menuBusy}
                      menuDisabled={menuDisabled}
                    />
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

function VirtualizedTrackTable<T>({
  actionColumnLabel,
  actionColumnWidth = DEFAULT_ACTION_COLUMN_WIDTH,
  columns,
  getItemKey,
  hasMenu,
  isActionMenuBusy,
  isActionMenuDisabled,
  items,
  menuActions = [],
  stickyActionColumn = true,
  stickyHeader = false,
  virtualization,
}: TrackTableSharedProps<T> & {
  virtualization: TrackTableVirtualizationConfig;
}) {
  const scrollElementRef = useRef<HTMLDivElement | null>(null);
  const gridTemplateColumns = getGridTemplateColumns(
    columns,
    hasMenu,
    actionColumnWidth
  );
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    estimateSize: () => virtualization.rowHeight,
    getScrollElement: () => scrollElementRef.current,
    overscan: virtualization.overscan ?? DEFAULT_OVERSCAN,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div className="w-full overflow-x-auto">
      <div className="min-w-full w-max lg:w-full">
        <div
          className={cn(
            "border-b border-border/60",
            stickyHeader ? "sticky top-0 z-20 bg-card/90 backdrop-blur-md" : "bg-card"
          )}
          style={{ gridTemplateColumns }}
        >
          <div className="grid" style={{ gridTemplateColumns }}>
            {columns.map((column) => (
              <div
                className={cn(TABLE_HEADER_GRID_CELL_CLASS, column.headClassName)}
                key={column.id}
                title={column.headerTitle}
              >
                {column.header}
              </div>
            ))}
            {hasMenu ? (
              <div
                className={cn(
                  TABLE_HEADER_GRID_CELL_CLASS,
                  "justify-end text-right",
                  stickyActionColumn ? "sticky right-0 z-30 bg-card" : null
                )}
              >
                <span className="sr-only">{actionColumnLabel}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div
          className={cn("relative overflow-y-auto", virtualization.bodyHeightClassName)}
          ref={scrollElementRef}
        >
          <div
            className="relative"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {virtualRows.map((virtualRow) => {
              const item = items[virtualRow.index];

              if (!item) {
                return null;
              }

              const menuBusy =
                isActionMenuBusy?.(item, virtualRow.index) ?? false;
              const menuDisabled =
                isActionMenuDisabled?.(item, virtualRow.index) ?? false;

              return (
                <div
                  className={cn(
                    "group/track-row absolute top-0 left-0 right-0 grid",
                    TABLE_ROW_CLASS
                  )}
                  key={getItemKey(item, virtualRow.index)}
                  style={{
                    gridTemplateColumns,
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {columns.map((column) => (
                    <div
                      className={cn(TABLE_BODY_CELL_CLASS, column.cellClassName)}
                      key={column.id}
                      title={resolveTitle(column.title, item, virtualRow.index)}
                    >
                      {column.render(item, virtualRow.index)}
                    </div>
                  ))}
                  {hasMenu ? (
                    <div
                      className={cn(
                        TABLE_BODY_CELL_CLASS,
                        "flex items-center justify-end pr-3",
                        stickyActionColumn
                          ? "sticky right-0 z-10 bg-card transition-colors group-hover/track-row:bg-muted"
                          : null
                      )}
                    >
                      <TrackTableActionMenu
                        actionColumnLabel={actionColumnLabel}
                        getItemKey={getItemKey}
                        index={virtualRow.index}
                        item={item}
                        menuActions={menuActions}
                        menuBusy={menuBusy}
                        menuDisabled={menuDisabled}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
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
  actionColumnWidth = DEFAULT_ACTION_COLUMN_WIDTH,
  stickyHeader = false,
  stickyActionColumn = true,
  isActionMenuBusy,
  isActionMenuDisabled,
  virtualization,
}: TrackTableProps<T>) {
  const hasMenu = menuActions.length > 0;
  const sharedProps = {
    actionColumnLabel,
    actionColumnWidth,
    columns,
    getItemKey,
    hasMenu,
    isActionMenuBusy,
    isActionMenuDisabled,
    items,
    menuActions,
    stickyActionColumn,
    stickyHeader,
  };

  if (virtualization) {
    return (
      <VirtualizedTrackTable
        {...sharedProps}
        virtualization={virtualization}
      />
    );
  }

  return <StandardTrackTable {...sharedProps} />;
}
