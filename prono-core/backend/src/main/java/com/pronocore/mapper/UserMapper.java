package com.pronocore.mapper;

import com.pronocore.dto.response.UserResponse;
import com.pronocore.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "avatarUrl", source = "effectiveAvatarUrl")
    @Mapping(target = "customAvatarUrl", source = "avatarUrl")
    UserResponse toResponse(User user);
}
