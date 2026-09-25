/**
 * L'onglet S'entraîner du hub Musculation — US MUSCU-UX07, §4.2.
 *
 * De haut en bas : la carte du moment (avec « la dernière fois » un jour de séance), « Refaire une
 * séance » (les trois dernières, un geste chacune), « Autre chose » (séance libre, modèles), puis
 * « Ton programme » — ou les programmes suggérés à qui n'en a pas.
 *
 * Pendant une séance, seule la carte « Reprendre » reste (R8) : proposer d'en commencer une autre
 * serait proposer ce que R4 refuse.
 */

import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import type { HubState } from '@wellness/shared';
import type { WorkoutHistoryItem } from '@/data/repositories/workout-repository';
import { LastTimeList, type LastTimeExercise } from '@/components/strength/LastTimeList';
import { MomentCard, type DoneTodayWorkout } from '@/components/strength/MomentCard';
import { OtherActions } from '@/components/strength/OtherActions';
import { RecentWorkouts } from '@/components/strength/RecentWorkouts';

type Props = {
  state: HubState;
  doneToday: DoneTodayWorkout | null;
  weekLabel: string | null;
  nextLabel: string | null;
  todayExercises: readonly LastTimeExercise[];
  todayProgram: { programId: string | null; weekIndex: number | null };
  workouts: readonly WorkoutHistoryItem[];
  todayKey: string;
  starting: boolean;
  modeLine: ReactNode;
  /** « Ton programme », ou les programmes suggérés sans programme actif. */
  programBlock: ReactNode;
  onStart: () => void;
  onResume: () => void;
  onSummary: () => void;
  onShare: () => void;
  onPlanning: () => void;
  onPrograms: () => void;
  onPreview: () => void;
  onOpenWorkout: (workoutId: string) => void;
  onRedo: (workoutId: string) => void;
  onAllHistory: () => void;
  onFree: () => void;
  onTemplates: () => void;
};

export function TrainSection(props: Props) {
  const inProgress = props.state.kind === 'resume';

  return (
    <View style={styles.section} testID="strength-section-train">
      <MomentCard
        state={props.state}
        doneToday={props.doneToday}
        weekLabel={props.weekLabel}
        nextLabel={props.nextLabel}
        starting={props.starting}
        onStart={props.onStart}
        onResume={props.onResume}
        onSummary={props.onSummary}
        onShare={props.onShare}
        onPlanning={props.onPlanning}
        onPrograms={props.onPrograms}
        onPreview={props.onPreview}
        lastTime={
          props.state.kind === 'today' ? (
            <LastTimeList exercises={props.todayExercises} program={props.todayProgram} />
          ) : null
        }
        modeLine={props.modeLine}
      />

      {inProgress ? null : (
        <>
          <RecentWorkouts
            workouts={props.workouts}
            todayKey={props.todayKey}
            onOpen={props.onOpenWorkout}
            onRedo={props.onRedo}
            onAllHistory={props.onAllHistory}
          />
          <OtherActions onFree={props.onFree} onTemplates={props.onTemplates} />
        </>
      )}

      {props.programBlock}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 18 },
});
