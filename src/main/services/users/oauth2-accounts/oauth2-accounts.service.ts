import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Observable, from } from 'rxjs';
import { OAuth2Account } from '@entities/users/oauth2-account.entity';
import { User } from '@entities/users/user.entity';

@Injectable()
export class OAuth2AccountsService {

    constructor (
        @InjectRepository(OAuth2Account) private readonly oauth2accountsRepository: Repository<OAuth2Account>
    ) {
    }

    find(userId: number): Observable<OAuth2Account[]> {
        return from(this.oauth2accountsRepository.findBy({
            userId
        }));
    }

    async findOneByEmail(email: string): Promise<OAuth2Account | null> {
        const loadedOAuth2AccountOrNull = await this.oauth2accountsRepository.findOne({
            relations: {
                user: true
            },
            where: {
                email
            }
        });

        return loadedOAuth2AccountOrNull;
    }

    create(
        user: User,
        oauth2account: OAuth2Account
    ): Promise<OAuth2Account> {
        return this._create(this.oauth2accountsRepository.manager, user, oauth2account);
    }

    _create(
        manager: EntityManager,
        user: User,
        oauth2account: OAuth2Account
    ): Promise<OAuth2Account> {
        const _oauth2accountsRepository = manager.getRepository(OAuth2Account);

        oauth2account.user = user;

        return _oauth2accountsRepository.save(oauth2account);
    }
}
