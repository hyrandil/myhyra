import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { Tag } from '../api';

interface Props {
  tags: Tag[];
  selected: number[];
  onToggle: (id: number) => void;
}

const TagFilter: React.FC<Props> = ({ tags, selected, onToggle }) => {
  return (
    <Box>
      <Typography variant="subtitle1" gutterBottom>
        Tags
      </Typography>
      <Box display="flex" flexWrap="wrap" gap={1}>
        {tags.map((tag) => {
          const isSelected = selected.includes(tag.id);
          return (
            <Chip
              key={tag.id}
              label={tag.name}
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              onClick={() => onToggle(tag.id)}
            />
          );
        })}
      </Box>
    </Box>
  );
};

export default TagFilter;
