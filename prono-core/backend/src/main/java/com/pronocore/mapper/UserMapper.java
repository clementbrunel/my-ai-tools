package com.pronocore.mapper;

import com.pronocore.dto.response.UserResponse;
import com.pronocore.entity.User;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface UserMapper {

    UserResponse toResponse(User user);
}
