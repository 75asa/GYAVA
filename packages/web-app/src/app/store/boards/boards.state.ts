import { Injectable } from '@angular/core';
import { State, Action, StateContext, Selector } from '@ngxs/store';
import { GitHubGraphQLService } from '@service/github-graphql.service';
import { BoardsStateModel } from '@store/boards/boards.interface';
import { BoardsAction } from './boards.action';

@State<BoardsStateModel>({
  name: 'boards',
  defaults: {
    boards: [],
  },
})
@Injectable()
export class BoardsState {
  @Selector()
  static getOrgNameNumber(state: BoardsStateModel) {
    return (name: string, number: number) => {
      return state.boards.find((p) => {
        return p.type === 'org' && p.name === name && p.number === number;
      });
    };
  }

  constructor(private readonly githubClient: GitHubGraphQLService) {}

  @Action(BoardsAction.addOrgProject)
  async addOrgProject(
    ctx: StateContext<BoardsStateModel>,
    action: BoardsAction.addOrgProject,
  ) {
    let hasMoreItems = false;
    const projectNextList = [];
    const result = await this.githubClient.projectByOrgs(
      action.org,
      action.number,
    );
    if (result.data.organization?.projectNext) {
      projectNextList.push(result.data.organization.projectNext);
    }
    hasMoreItems =
      !!result.data.organization?.projectNext?.items.pageInfo.hasNextPage &&
      !!result.data.organization?.projectNext?.items.pageInfo.endCursor;

    if (hasMoreItems) {
      do {
        const hasMoreProject = await this.githubClient.getProjectIssues(
          action.org,
          action.number,
          result.data.organization!.projectNext!.items.pageInfo.endCursor!,
        );
        projectNextList.push(hasMoreProject.data.organization?.projectNext);
        hasMoreItems =
          hasMoreProject.data.organization!.projectNext!.items.pageInfo
            .hasNextPage;
      } while (hasMoreItems);
    }
    console.log({ projectNextList });
    const state = ctx.getState();
    const boards = [...state.boards.map((r) => ({ ...r }))];
    const existing = boards.find((p) => {
      return (
        p.type === 'org' && p.name === action.org && p.number === action.number
      );
    });
    if (!result.data.organization?.projectNext) throw new Error('not found');
    if (existing) {
      existing.projectNext = result.data.organization?.projectNext;
    } else {
      boards.push({
        type: 'org',
        name: action.org,
        number: action.number,
        projectNext: result.data.organization?.projectNext,
      });
    }
    ctx.setState({
      ...state,
      boards,
    });
  }

  @Action(BoardsAction.updateOrgProjectSetting)
  async updateSetting(
    ctx: StateContext<BoardsStateModel>,
    action: BoardsAction.updateOrgProjectSetting,
  ) {
    const state = ctx.getState();
    const boards = [...state.boards.map((r) => ({ ...r }))];
    const existing = boards.find((p) => {
      return (
        p.type === 'org' && p.name === action.org && p.number === action.number
      );
    });
    if (!existing) {
      console.error('org project not found', action, state);
      throw new Error('org project not found');
    }
    existing.setting = action.setting;
    ctx.setState({
      ...state,
      boards,
    });
  }
}
