import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type React from 'react';

/**
 * Primitive de réordonnancement réutilisable du constructeur de programmes
 * (US 8.4). Une liste verticale glisser-déposer générique, câblée sur @dnd-kit,
 * utilisée à la fois pour réordonner les **séances** d'un programme et les
 * **exercices planifiés** d'une séance.
 *
 * Accessible au clavier (`KeyboardSensor` + `sortableKeyboardCoordinates`) autant
 * qu'à la souris/au tactile (`PointerSensor`). La liste est **contrôlée par le
 * parent** : elle n'a pas d'état d'ordre propre au-delà de ce dont @dnd-kit a
 * besoin pendant le drag. Ainsi, si la persistance échoue, le parent peut
 * remettre l'ordre initial (exigence de la spec : rollback offline-first).
 *
 * Aucune chaîne d'UI en dur : le parent fournit le rendu de chaque ligne via
 * `renderItem`, qui reçoit les props de la poignée de glisse à répandre sur
 * l'élément qui doit servir de « grab handle ».
 */
export type SortableListProps<T> = {
  /** Éléments affichés, dans leur ordre courant (source de vérité = parent). */
  items: T[];
  /** Identifiant stable d'un élément (sert de clé @dnd-kit). */
  getId: (item: T) => string;
  /** Appelé une seule fois par dépôt utile, avec le nouvel ordre complet des id. */
  onReorder: (orderedIds: string[]) => void;
  /**
   * Rendu d'une ligne. `dragHandle` porte les props à répandre sur l'élément
   * poignée (`{...attributes, ...listeners}` de @dnd-kit) pour que le parent
   * décide quel élément déclenche le glisser.
   */
  renderItem: (item: T, dragHandle: React.HTMLAttributes<HTMLElement>) => React.ReactNode;
};

/** Ligne triable interne : câble `useSortable` et applique transform/transition. */
function SortableRow<T>({
  item,
  id,
  renderItem,
}: {
  item: T;
  id: string;
  renderItem: SortableListProps<T>['renderItem'];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  // La poignée reçoit les attributs a11y + écouteurs de @dnd-kit ; le parent les
  // répand sur l'élément de son choix (ex. un bouton ⠿).
  const dragHandle: React.HTMLAttributes<HTMLElement> = {
    ...attributes,
    ...(listeners as React.HTMLAttributes<HTMLElement>),
  };

  return (
    <div ref={setNodeRef} style={style}>
      {renderItem(item, dragHandle)}
    </div>
  );
}

/** Liste verticale triable, générique et contrôlée (voir en-tête de fichier). */
export function SortableList<T>({
  items,
  getId,
  onReorder,
  renderItem,
}: SortableListProps<T>): React.ReactElement {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = items.map(getId);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    // Dépôt hors zone ou au même endroit : aucun changement, on ne notifie pas.
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) {
      return;
    }
    const next = arrayMove(ids, oldIndex, newIndex);
    onReorder(next);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map((item) => {
          const id = getId(item);
          return <SortableRow key={id} id={id} item={item} renderItem={renderItem} />;
        })}
      </SortableContext>
    </DndContext>
  );
}
