import type { Request, Response } from 'express';
import type { AppContext } from '../context.js';

export function adminController(ctx: AppContext) {
  return {
    async login(req: Request, res: Response) {
      const { username, password } = req.valid!.body;
      res.json(await ctx.auth.login(username, password, req.ip));
    },
    logout(req: Request, res: Response) {
      ctx.auth.logout(req.adminToken!);
      res.json({ ok: true });
    },
    me(req: Request, res: Response) {
      res.json({ admin: ctx.auth.publicAdmin(req.admin!) });
    },
    async changePassword(req: Request, res: Response) {
      const { currentPassword, newPassword } = req.valid!.body;
      const issued = await ctx.auth.changePassword(req.admin!, currentPassword, newPassword);
      ctx.auth.logout(req.adminToken!); // 기존 토큰 폐기
      res.json(issued);
    },
    overview(_req: Request, res: Response) {
      res.json(ctx.sessions.getOverview());
    },
    listAdmins(_req: Request, res: Response) {
      res.json({ admins: ctx.auth.listAdmins() });
    },
    async createAdmin(req: Request, res: Response) {
      const { username, password } = req.valid!.body;
      const created = await ctx.auth.createAdmin(req.admin!, username, password);
      res.status(201).json({ admin: created });
    },
    removeAdmin(req: Request, res: Response) {
      const { id } = req.valid!.params;
      ctx.auth.deleteAdmin(req.admin!, id, (adminId) => ctx.sessions.broadcaster.disconnectAdmin(adminId));
      res.json({ ok: true });
    },
    getSettings(_req: Request, res: Response) {
      res.json({
        projectorNameMode: ctx.repos.settings.get('projector_name_mode') ?? 'MASKED',
        leaderboardSize: Number(ctx.repos.settings.get('leaderboard_size') ?? 10),
      });
    },
    updateSettings(req: Request, res: Response) {
      const { projectorNameMode, leaderboardSize } = req.valid!.body;
      if (projectorNameMode) ctx.repos.settings.set('projector_name_mode', projectorNameMode);
      if (leaderboardSize) ctx.repos.settings.set('leaderboard_size', String(leaderboardSize));
      res.json({ ok: true });
    },
  };
}
