export const isDistantFuture = (date: Date, toleranceSecs = 0) => {
  return date.getTime() > Date.now() + toleranceSecs * 1000;
};

export const isDistantPast = (date: Date, toleranceSecs = 0) => {
  return date.getTime() < Date.now() - toleranceSecs * 1000;
};
