-- Migration 016: during the beta, every family gets the Family plan (#67, Oct 11). NEEDS OBIE'S OK.
-- Why: new families default to 'free', which allows only 2 people and 3 schools — so a parent + student
-- could not add the other parent, and the board stopped at 3 schools. There is no billing yet, so beta
-- families should have room for the whole family. The owner back office can change plans later.
-- What changes: (1) new families start on 'family'; (2) existing 'free' families move to 'family'.
-- Nothing is deleted. Undo: alter the default back to 'free' and set plan='free' for the same families.

alter table public.families alter column plan set default 'family';
update public.families set plan = 'family' where plan = 'free';
