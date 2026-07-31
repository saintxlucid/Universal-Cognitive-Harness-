export interface NeuromodulationState {
  learning_rate: number;
  exploration_rate: number;
  discount_factor: number;
  reward_sensitivity: number;
}

export interface ContextState {
  novelty: number;
  task_horizon: number;
  uncertainty: number;
  reward_history: number[];
}

export class Neuromodulation {
  private state: NeuromodulationState = {
    learning_rate: 0.1,
    exploration_rate: 0.3,
    discount_factor: 0.9,
    reward_sensitivity: 0.5,
  };

  getState(): NeuromodulationState {
    return { ...this.state };
  }

  update(context: ContextState): void {
    if (context.novelty > 0.7) {
      this.state.learning_rate = 0.3;
      this.state.exploration_rate = 0.6;
    } else if (context.novelty > 0.4) {
      this.state.learning_rate = 0.15;
      this.state.exploration_rate = 0.3;
    } else {
      this.state.learning_rate = 0.05;
      this.state.exploration_rate = 0.1;
    }

    if (context.task_horizon > 10) {
      this.state.discount_factor = 0.95;
    } else if (context.task_horizon > 5) {
      this.state.discount_factor = 0.85;
    } else {
      this.state.discount_factor = 0.7;
    }

    if (context.uncertainty > 0.6) {
      this.state.reward_sensitivity = 0.8;
      this.state.exploration_rate = Math.max(this.state.exploration_rate, 0.4);
    } else {
      this.state.reward_sensitivity = 0.4;
    }

    // Recent rewards modulate sensitivity
    if (context.reward_history.length > 0) {
      const avgReward = context.reward_history.reduce((a, b) => a + b, 0) / context.reward_history.length;
      if (avgReward < 0.3) {
        this.state.exploration_rate = Math.min(1.0, this.state.exploration_rate + 0.1);
      } else if (avgReward > 0.7) {
        this.state.exploration_rate = Math.max(0.0, this.state.exploration_rate - 0.05);
      }
    }
  }

  reset(): void {
    this.state = {
      learning_rate: 0.1,
      exploration_rate: 0.3,
      discount_factor: 0.9,
      reward_sensitivity: 0.5,
    };
  }
}
